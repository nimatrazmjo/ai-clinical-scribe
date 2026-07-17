import type { TemplateDto, CreateTemplateDto, UpdateTemplateDto } from '@contracts';
import { apiClient } from './apiClient';

export function getAllTemplates(signal?: AbortSignal): Promise<TemplateDto[]> {
  return apiClient.get<TemplateDto[]>('/templates?includeInactive=true', { signal });
}

export function createTemplate(body: CreateTemplateDto): Promise<TemplateDto> {
  return apiClient.post<TemplateDto>('/templates', body);
}

export function updateTemplate(id: string, body: UpdateTemplateDto): Promise<TemplateDto> {
  return apiClient.put<TemplateDto>(`/templates/${id}`, body);
}

export function deleteTemplate(id: string): Promise<void> {
  return apiClient.delete<void>(`/templates/${id}`);
}
