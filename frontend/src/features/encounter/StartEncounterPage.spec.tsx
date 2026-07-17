import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setupServer';
import { renderWithProviders } from '@/test/renderWithProviders';
import { demoEncounter } from '@/test/fixtures';
import { StartEncounterPage } from './StartEncounterPage';

function renderPage() {
  return renderWithProviders(<StartEncounterPage />, { initialEntries: ['/encounters/new'] });
}

async function fillForm(first = 'Jane', last = 'Smith', dob = '1980-06-15') {
  await userEvent.type(screen.getByLabelText('First name'), first);
  await userEvent.type(screen.getByLabelText('Last name'), last);
  await userEvent.type(screen.getByLabelText('Date of birth'), dob);
}

describe('StartEncounterPage', () => {
  it('renders all fields and buttons', () => {
    renderPage();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Date of birth')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start encounter' })).toBeInTheDocument();
  });

  it('validates required fields on empty submit', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start encounter' }));
    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Date of birth is required')).toBeInTheDocument();
  });

  it('rejects a future date of birth', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText('First name'), 'Jane');
    await userEvent.type(screen.getByLabelText('Last name'), 'Smith');
    await userEvent.type(screen.getByLabelText('Date of birth'), '2099-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Start encounter' }));
    expect(await screen.findByText('Date of birth must be in the past')).toBeInTheDocument();
  });

  it('rejects a DOB older than 120 years', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText('First name'), 'Jane');
    await userEvent.type(screen.getByLabelText('Last name'), 'Smith');
    await userEvent.type(screen.getByLabelText('Date of birth'), '1850-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Start encounter' }));
    expect(await screen.findByText('Date of birth is implausibly old')).toBeInTheDocument();
  });

  it('does not call API when validation fails', async () => {
    let called = false;
    server.use(http.post('*/encounters', () => { called = true; return HttpResponse.json({}); }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Start encounter' }));
    expect(called).toBe(false);
  });

  it('submits correct payload on success', async () => {
    let body: unknown;
    server.use(
      http.post('*/encounters', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(demoEncounter);
      }),
    );
    renderPage();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Start encounter' }));
    await waitFor(() => {
      expect(body).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1980-06-15',
      });
    });
  });

  it('shows error toast on API failure', async () => {
    server.use(
      http.post('*/encounters', () =>
        HttpResponse.json({ statusCode: 400, code: 'BAD_REQUEST', message: 'Invalid data' }, { status: 400 }),
      ),
    );
    renderPage();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Start encounter' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
