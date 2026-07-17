import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { AuthMe } from '@contracts';
import { UserRole } from '@contracts';
import { AuthContext } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

// Avoid MemoryRouter entirely — its history internals keep the worker thread alive.
// Mock only the two RR APIs ProtectedRoute actually uses.
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid={`navigate-${to}`} />,
  useLocation: () => ({ pathname: '/encounters' }),
}));

function Secret() {
  return <p>secret content</p>;
}

const providerUser: AuthMe = { id: 'p1', email: 'dr@demo.com', role: UserRole.Provider };

function renderRoute(
  ui: React.ReactNode,
  auth: { user: AuthMe | null; isLoading: boolean },
) {
  return render(
    <AuthContext.Provider
      value={{ user: auth.user, isLoading: auth.isLoading, setToken: vi.fn(), clearAuth: vi.fn() }}
    >
      {ui}
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    renderRoute(<ProtectedRoute><Secret /></ProtectedRoute>, { user: null, isLoading: false });
    expect(screen.getByTestId('navigate-/login')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderRoute(<ProtectedRoute><Secret /></ProtectedRoute>, { user: providerUser, isLoading: false });
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('redirects to /encounters when role not allowed', () => {
    renderRoute(
      <ProtectedRoute allowedRoles={[UserRole.Admin]}><Secret /></ProtectedRoute>,
      { user: providerUser, isLoading: false },
    );
    expect(screen.getByTestId('navigate-/encounters')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('shows loading while auth resolves', () => {
    renderRoute(<ProtectedRoute><Secret /></ProtectedRoute>, { user: null, isLoading: true });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
