import { useQuery } from '@tanstack/react-query';
import { getTemplates } from '@/api/templates';

export function useTemplatesQuery() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: ({ signal }) => getTemplates(signal),
    staleTime: 60_000,
  });
}
