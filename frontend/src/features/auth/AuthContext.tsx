import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthMe } from '@contracts';
import { getMe } from '@/api/auth';
import { ApiError, registerUnauthorizedHandler } from '@/api/apiClient';

const TOKEN_KEY = 'access_token';

interface AuthContextValue {
  user: AuthMe | null;
  isLoading: boolean;
  setToken: (token: string) => Promise<void>;
  clearAuth: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthMe | null>(null);
  const [isLoading, setIsLoading] = useState(() => !!sessionStorage.getItem(TOKEN_KEY));

  const clearAuth = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const setToken = useCallback(async (token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    try {
      const me = await getMe();
      setUser(me);
    } catch (err) {
      sessionStorage.removeItem(TOKEN_KEY);
      throw err;
    }
  }, []);

  // Wire global TOKEN_EXPIRED → clear session (catches expiry on any API call)
  useEffect(() => {
    registerUnauthorizedHandler(clearAuth);
  }, [clearAuth]);

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const ctrl = new AbortController();
    getMe(ctrl.signal)
      .then(setUser)
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && (err.code === 'TOKEN_EXPIRED' || err.statusCode === 401)) {
          sessionStorage.removeItem(TOKEN_KEY);
        }
      })
      .finally(() => { if (!ctrl.signal.aborted) setIsLoading(false); });
    return () => ctrl.abort();
  }, []);

  return (
    <AuthContext value={{ user, isLoading, setToken, clearAuth }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
