import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '@/api/auth';
import { ApiError } from '@/api/apiClient';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/useToast';

interface LoginState {
  isLoading: boolean;
  error: string | null;
}

export function useAuthApi() {
  const [state, setState] = useState<LoginState>({ isLoading: false, error: null });
  const { setToken, clearAuth } = useAuth();
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  async function doLogin(email: string, password: string): Promise<boolean> {
    setState({ isLoading: true, error: null });
    try {
      const { accessToken } = await login({ email, password });
      await setToken(accessToken);
      const from = (location.state as { from?: string } | null)?.from ?? '/encounters';
      navigate(from, { replace: true });
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError && err.statusCode === 401
          ? 'Invalid email or password'
          : err instanceof ApiError && err.statusCode === 429
            ? 'Too many login attempts. Please wait a moment.'
            : 'Login failed. Please try again.';
      setState({ isLoading: false, error: message });
      toastError(message);
      return false;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }

  function doLogout() {
    clearAuth();
    navigate('/login');
  }

  return { ...state, doLogin, doLogout };
}
