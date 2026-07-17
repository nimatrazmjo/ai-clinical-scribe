import type { UserRole } from '@contracts';
import { useAuth } from './AuthContext';

export function useAuthGuard(allowedRoles?: UserRole[]) {
  const { user, isLoading } = useAuth();
  const hasRole = !allowedRoles || (!!user && allowedRoles.includes(user.role));
  return { user, isLoading, hasRole };
}
