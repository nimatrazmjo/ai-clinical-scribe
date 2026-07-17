import { useQuery } from '@tanstack/react-query';
import { getNoteVersions } from '@/api/notes';

export function useNoteVersionsQuery(encounterId: string) {
  return useQuery({
    queryKey: ['encounters', encounterId, 'notes'],
    queryFn: ({ signal }) => getNoteVersions(encounterId, signal),
    enabled: !!encounterId,
  });
}
