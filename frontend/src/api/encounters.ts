import { apiClient } from './apiClient';
import type { EncounterDto, StartEncounterDto, UpdateDraftDto, SetTranscriptDto } from '@contracts';

export function getEncounters(): Promise<EncounterDto[]> {
  return apiClient.get<EncounterDto[]>('/encounters');
}

export function getEncounter(id: string): Promise<EncounterDto> {
  return apiClient.get<EncounterDto>(`/encounters/${id}`);
}

export function createEncounter(dto: StartEncounterDto): Promise<EncounterDto> {
  return apiClient.post<EncounterDto>('/encounters', dto);
}

export function setTranscript(id: string, dto: SetTranscriptDto): Promise<EncounterDto> {
  return apiClient.patch<EncounterDto>(`/encounters/${id}/transcript`, dto);
}

export function updateDraft(id: string, dto: UpdateDraftDto): Promise<EncounterDto> {
  return apiClient.patch<EncounterDto>(`/encounters/${id}/draft`, dto);
}
