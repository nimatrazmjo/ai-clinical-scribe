import { apiClient } from './apiClient';
import type { EncounterDto, StartEncounterDto } from '@contracts';

export function getEncounters(): Promise<EncounterDto[]> {
  return apiClient.get<EncounterDto[]>('/encounters');
}

export function getEncounter(id: string): Promise<EncounterDto> {
  return apiClient.get<EncounterDto>(`/encounters/${id}`);
}

export function createEncounter(dto: StartEncounterDto): Promise<EncounterDto> {
  return apiClient.post<EncounterDto>('/encounters', dto);
}
