import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setupServer';
import { renderWithProviders } from '@/test/renderWithProviders';
import { demoProviderToken } from '@/test/fixtures';
import { LoginPage } from './LoginPage';

function renderLogin() {
  return renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('validates empty email', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
  });

  it('validates invalid email format', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'notanemail');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('validates empty password', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'dr@demo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
  });

  it('no API call when validation fails', async () => {
    let called = false;
    server.use(http.post('*/auth/login', () => { called = true; return HttpResponse.json({}); }));
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(called).toBe(false);
  });

  it('shows error toast on 401', async () => {
    server.use(
      http.post('*/auth/login', () =>
        HttpResponse.json({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'bad creds' }, { status: 401 }),
      ),
      http.get('*/auth/me', () =>
        HttpResponse.json({ statusCode: 401, code: 'TOKEN_EXPIRED', message: 'expired' }, { status: 401 }),
      ),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'dr@demo.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('stores token and redirects on success', async () => {
    server.use(
      http.post('*/auth/login', () =>
        HttpResponse.json({ accessToken: demoProviderToken }),
      ),
      http.get('*/auth/me', () =>
        HttpResponse.json({ id: 'p1', email: 'dr@demo.com', role: 'provider' }),
      ),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'dr@demo.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(sessionStorage.getItem('access_token')).toBe(demoProviderToken);
    });
  });
});
