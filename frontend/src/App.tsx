import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">{title}</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Placeholder title="AI Clinical Scribe" />} />
          <Route path="/login" element={<Placeholder title="Login" />} />
          <Route path="/encounters" element={<Placeholder title="Encounters" />} />
          <Route path="/encounters/:id" element={<Placeholder title="Encounter" />} />
          <Route path="/admin" element={<Placeholder title="Admin" />} />
          <Route path="*" element={<Placeholder title="Not found" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
