import type { SoapNote } from './soap';

export interface LoginDto {
  email: string;
  password: string;
}

export interface StartEncounterDto {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  transcript?: string;
  templateId?: string;
}

export interface UpdateDraftDto {
  draft: SoapNote;
}

export interface SetTranscriptDto {
  text: string;
}

export interface SaveNoteDto {
  soapNote: SoapNote;
  draftRevision?: number;
}

export interface CreateTemplateDto {
  name: string;
  promptBody: string;
  encounterType?: string;
}

export interface UpdateTemplateDto {
  name?: string;
  promptBody?: string;
  encounterType?: string;
  isActive?: boolean;
}

export interface CreateProviderDto {
  email: string;
  password: string;
  role?: 'provider' | 'admin';
}
