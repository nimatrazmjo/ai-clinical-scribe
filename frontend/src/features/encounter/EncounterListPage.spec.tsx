import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setupServer';
import { renderWithProviders } from '@/test/renderWithProviders';
import { demoEncounter, demoFinalizedEncounter } from '@/test/fixtures';
import { EncounterListPage } from './EncounterListPage';

function renderList() {
  return renderWithProviders(<EncounterListPage />, { initialEntries: ['/encounters'] });
}

describe('EncounterListPage', () => {
  it('shows loading state initially', () => {
    server.use(http.get('*/encounters', async () => {
      await new Promise(() => {});
      return HttpResponse.json([]);
    }));
    renderList();
    expect(screen.getByLabelText('Loading encounters')).toBeInTheDocument();
  });

  it('shows empty state when no encounters', async () => {
    server.use(http.get('*/encounters', () => HttpResponse.json([])));
    renderList();
    expect(await screen.findByText('No encounters yet.')).toBeInTheDocument();
    expect(screen.getByText('Start your first encounter')).toBeInTheDocument();
  });

  it('renders encounter list with patient names', async () => {
    server.use(
      http.get('*/encounters', () =>
        HttpResponse.json([demoEncounter, demoFinalizedEncounter]),
      ),
    );
    renderList();
    await waitFor(() => {
      expect(screen.getAllByText('Doe, John')).toHaveLength(2);
    });
  });

  it('shows status badges', async () => {
    server.use(
      http.get('*/encounters', () =>
        HttpResponse.json([demoEncounter, demoFinalizedEncounter]),
      ),
    );
    renderList();
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
    expect(screen.getByText('Finalized')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    server.use(
      http.get('*/encounters', () =>
        HttpResponse.json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Server error' }, { status: 500 }),
      ),
    );
    renderList();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('"New encounter" link is always visible', async () => {
    server.use(http.get('*/encounters', () => HttpResponse.json([])));
    renderList();
    await screen.findByText('No encounters yet.');
    expect(screen.getAllByText(/New encounter|Start your first encounter/)).toHaveLength(2);
  });
});
