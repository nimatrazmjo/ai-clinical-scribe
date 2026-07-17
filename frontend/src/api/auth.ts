import { apiClient } from './apiClient';
import type { AuthMe, AuthResponse, LoginDto } from '@contracts';

export function login(dto: LoginDto): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/login', dto);
}

export function getMe(signal?: AbortSignal): Promise<AuthMe> {
  return apiClient.get<AuthMe>('/auth/me', { signal });
}
