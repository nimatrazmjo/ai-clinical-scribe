import type { EncounterDto, CreateProviderDto } from '@contracts';
import { apiClient } from './apiClient';

export interface ProviderDto {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export function getAdminEncounters(
  params?: { providerId?: string; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<EncounterDto[]> {
  const qs = new URLSearchParams();
  if (params?.providerId) qs.set('providerId', params.providerId);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const query = qs.toString();
  return apiClient.get<EncounterDto[]>(`/admin/encounters${query ? `?${query}` : ''}`, { signal });
}

export function getAdminProviders(signal?: AbortSignal): Promise<ProviderDto[]> {
  return apiClient.get<ProviderDto[]>('/admin/providers', { signal });
}

export function createProvider(body: CreateProviderDto): Promise<ProviderDto> {
  return apiClient.post<ProviderDto>('/admin/providers', body);
}

export function deactivateProvider(id: string): Promise<void> {
  return apiClient.patch<void>(`/admin/providers/${id}/deactivate`);
}
