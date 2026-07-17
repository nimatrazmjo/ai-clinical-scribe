import { useQuery } from '@tanstack/react-query';
import { getEncounter } from '@/api/encounters';

export function encounterQueryKey(id: string) {
  return ['encounter', id] as const;
}

export function useEncounterQuery(id: string) {
  return useQuery({
    queryKey: encounterQueryKey(id),
    queryFn: () => getEncounter(id),
    enabled: !!id,
  });
}
