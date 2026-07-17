import { useQuery } from '@tanstack/react-query';
import { searchIcd10 } from '@/api/icd10';

export function useIcd10Search(query: string) {
  return useQuery({
    queryKey: ['icd10', query],
    queryFn: ({ signal }) => searchIcd10(query, signal),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: [],
  });
}
