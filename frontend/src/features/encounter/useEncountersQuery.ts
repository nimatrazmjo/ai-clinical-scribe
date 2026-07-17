import { useQuery } from '@tanstack/react-query';
import { getEncounters } from '@/api/encounters';

export const encountersQueryKey = ['encounters'] as const;

export function useEncountersQuery() {
  return useQuery({
    queryKey: encountersQueryKey,
    queryFn: getEncounters,
  });
}
