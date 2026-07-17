import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setupServer';
import { renderWithProviders } from '@/test/renderWithProviders';
import { demoEncounter, demoFinalizedEncounter } from '@/test/fixtures';
import { EncounterPage } from './EncounterPage';

function renderPage(id = 'encounter-1') {
  return renderWithProviders(
    <Routes>
      <Route path="/encounters/:id" element={<EncounterPage />} />
    </Routes>,
    { initialEntries: [`/encounters/${id}`] },
  );
}

describe('EncounterPage', () => {
  // shouldAdvanceTime lets real wall-clock time pass so findBy/waitFor polling works
  // while still giving us vi.advanceTimersByTime() for the debounce test.
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows loading skeleton while fetching', () => {
    server.use(http.get('*/encounters/*', async () => {
      await new Promise(() => {});
      return HttpResponse.json({});
    }));
    renderPage();
    expect(screen.queryByText('Doe, John')).not.toBeInTheDocument();
  });

  it('renders patient name and transcript textarea', async () => {
    server.use(http.get('*/encounters/*', () => HttpResponse.json(demoEncounter)));
    await act(async () => { renderPage(); });
    expect(await screen.findByText('Doe, John')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Encounter transcript' })).toBeInTheDocument();
  });

  it('restores transcript from server on mount', async () => {
    const enc = { ...demoEncounter, transcript: 'Patient was seen today.' };
    server.use(http.get('*/encounters/*', () => HttpResponse.json(enc)));
    await act(async () => { renderPage(); });
    const textarea = await screen.findByRole('textbox', { name: 'Encounter transcript' });
    expect(textarea).toHaveValue('Patient was seen today.');
  });

  it('shows unsaved status while typing', async () => {
    server.use(http.get('*/encounters/*', () => HttpResponse.json(demoEncounter)));
    await act(async () => { renderPage(); });
    await screen.findByRole('textbox', { name: 'Encounter transcript' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Encounter transcript' }), 'new text');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('shows saved status after debounce elapses', async () => {
    server.use(
      http.get('*/encounters/*', () => HttpResponse.json(demoEncounter)),
      http.patch('*/encounters/*/transcript', () => HttpResponse.json(demoEncounter)),
    );
    await act(async () => { renderPage(); });
    await screen.findByRole('textbox', { name: 'Encounter transcript' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Encounter transcript' }), 'hello');
    await waitFor(() => {
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  it('makes transcript read-only for finalized encounter', async () => {
    server.use(http.get('*/encounters/*', () => HttpResponse.json(demoFinalizedEncounter)));
    await act(async () => { renderPage('encounter-2'); });
    const textarea = await screen.findByRole('textbox', { name: 'Encounter transcript' });
    expect(textarea).toHaveAttribute('readonly');
  });

  it('shows error state on fetch failure', async () => {
    server.use(
      http.get('*/encounters/*', () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    await act(async () => { renderPage(); });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
