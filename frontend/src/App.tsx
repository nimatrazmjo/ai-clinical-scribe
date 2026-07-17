import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { EncounterListPage } from './features/encounter/EncounterListPage';
import { Layout } from './components/Layout';
import { Toasts } from './components/Toasts';
import { useAuth } from './features/auth/AuthContext';

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

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Layout userName={user?.email} onLogout={undefined}>
            <Navigate to="/encounters" replace />
          </Layout>
        }
      />
      <Route
        path="/encounters"
        element={
          <Layout userName={user?.email}>
            <EncounterListPage />
          </Layout>
        }
      />
      <Route
        path="/encounters/new"
        element={
          <Layout userName={user?.email}>
            <Placeholder title="New encounter — coming in FE-06" />
          </Layout>
        }
      />
      <Route
        path="/encounters/:id"
        element={
          <Layout userName={user?.email}>
            <Placeholder title="Encounter workspace — coming in FE-07" />
          </Layout>
        }
      />
      <Route
        path="/admin"
        element={
          <Layout userName={user?.email}>
            <Placeholder title="Admin dashboard — coming in FE-15" />
          </Layout>
        }
      />
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
