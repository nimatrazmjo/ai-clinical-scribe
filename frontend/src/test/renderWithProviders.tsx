import { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Toasts } from '@/components/Toasts';
import { AuthProvider } from '@/features/auth/AuthContext';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperOptions {
  initialEntries?: string[];
}

function AllProviders({ children, initialEntries = ['/'] }: { children: ReactNode } & WrapperOptions) {
  const queryClient = makeQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
            <Toasts />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactNode,
  options?: Omit<RenderOptions, 'wrapper'> & WrapperOptions,
) {
  const { initialEntries, ...renderOptions } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}
