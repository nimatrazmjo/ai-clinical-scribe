import type { Icd10Match } from '@contracts';
import { apiClient } from './apiClient';

export function searchIcd10(query: string, signal?: AbortSignal): Promise<Icd10Match[]> {
  const params = new URLSearchParams({ q: query });
  return apiClient.get<Icd10Match[]>(`/icd10/search?${params.toString()}`, { signal });
}
