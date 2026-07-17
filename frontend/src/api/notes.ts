import type { NoteVersionDto, SaveNoteDto } from '@contracts';
import { apiClient } from './apiClient';

export function saveNote(encounterId: string, body: SaveNoteDto): Promise<NoteVersionDto> {
  return apiClient.post<NoteVersionDto>(`/encounters/${encounterId}/notes`, body);
}

export function getNoteVersions(encounterId: string, signal?: AbortSignal): Promise<NoteVersionDto[]> {
  return apiClient.get<NoteVersionDto[]>(`/encounters/${encounterId}/notes`, { signal });
}
