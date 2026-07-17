import type { SoapNoteDiff } from '@contracts';
import { apiClient } from './apiClient';

export function getVersionDiff(
  encounterId: string,
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<SoapNoteDiff> {
  return apiClient.get<SoapNoteDiff>(
    `/encounters/${encounterId}/versions/diff?from=${from}&to=${to}`,
    { signal },
  );
}
