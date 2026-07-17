import type { TemplateDto } from '@contracts';
import { apiClient } from './apiClient';

export function getTemplates(signal?: AbortSignal): Promise<TemplateDto[]> {
  return apiClient.get<TemplateDto[]>('/templates', { signal });
}
