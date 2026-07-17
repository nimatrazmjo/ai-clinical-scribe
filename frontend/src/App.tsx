import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { useAuthApi } from './features/auth/useAuthApi';
import { EncounterListPage } from './features/encounter/EncounterListPage';
import { StartEncounterPage } from './features/encounter/StartEncounterPage';
import { EncounterPage } from './features/encounter/EncounterPage';
import { Layout } from './components/Layout';
import { Toasts } from './components/Toasts';
import { UserRole } from '@contracts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <p className="text-muted-foreground text-sm">{title}</p>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { doLogout } = useAuthApi();
  return (
    <Layout userName={user?.email} onLogout={doLogout}>
      {children}
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/encounters"
        element={
          <ProtectedRoute>
            <AppShell><EncounterListPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/encounters/new"
        element={
          <ProtectedRoute allowedRoles={[UserRole.Provider]}>
            <AppShell><StartEncounterPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/encounters/:id"
        element={
          <ProtectedRoute allowedRoles={[UserRole.Provider]}>
            <AppShell><EncounterPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[UserRole.Admin]}>
            <AppShell><Placeholder title="Admin dashboard — coming in FE-15" /></AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/encounters" replace />} />
      <Route path="*" element={<Navigate to="/encounters" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
              <Toasts />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
