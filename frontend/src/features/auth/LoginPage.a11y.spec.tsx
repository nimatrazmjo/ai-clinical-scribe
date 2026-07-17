import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AuthMe } from '@contracts';
import { UserRole } from '@contracts';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthContext } from './AuthContext';

// Mock RR APIs so no MemoryRouter needed (avoids worker-hang issue)
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid={`navigate-${to}`} />,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const noAuth = { user: null, isLoading: false, setToken: vi.fn(), clearAuth: vi.fn() };
const withUser = (user: AuthMe) => ({ user, isLoading: false, setToken: vi.fn(), clearAuth: vi.fn() });
const providerUser: AuthMe = { id: 'p1', email: 'dr@demo.com', role: UserRole.Provider };

describe('LoginPage a11y', () => {
  it('has no critical axe violations', async () => {
    const { LoginPage } = await import('./LoginPage');
    const { container } = render(
      <ToastProvider>
        <AuthContext.Provider value={noAuth}>
          <LoginPage />
        </AuthContext.Provider>
      </ToastProvider>,
    );
    const results = await axe(container);
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});

describe('ProtectedRoute a11y', () => {
  it('loading state has no critical violations', async () => {
    const { ProtectedRoute } = await import('./ProtectedRoute');
    const { container } = render(
      <AuthContext.Provider value={{ ...noAuth, isLoading: true }}>
        <ProtectedRoute><div>content</div></ProtectedRoute>
      </AuthContext.Provider>,
    );
    const results = await axe(container);
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('authenticated state has no critical violations', async () => {
    const { ProtectedRoute } = await import('./ProtectedRoute');
    const { container } = render(
      <AuthContext.Provider value={withUser(providerUser)}>
        <ProtectedRoute>
          <main><h1>Encounters</h1></main>
        </ProtectedRoute>
      </AuthContext.Provider>,
    );
    const results = await axe(container);
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});
