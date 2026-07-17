import type { SoapNote } from './soap';
import type { EncounterStatus, UserRole } from './enums';

export interface AuthResponse {
  accessToken: string;
}

export interface AuthMe {
  id: string;
  email: string;
  role: UserRole;
}

export interface EncounterDto {
  id: string;
  status: EncounterStatus;
  patientFirstName: string;
  patientLastName: string;
  patientDateOfBirth: string;
  transcript: string | null;
  draft: SoapNote | null;
  draftRevision: number;
  templateId: string | null;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteVersionDto {
  id: string;
  encounterId: string;
  versionNumber: number;
  soapNote: SoapNote;
  savedById: string;
  savedByEmail: string;
  createdAt: string;
}

export interface TemplateDto {
  id: string;
  name: string;
  promptBody: string;
  encounterType: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Icd10Match {
  code: string;
  description: string;
  score: number;
}

export interface SoapNoteDiff {
  subjective: FieldDiff;
  objective: FieldDiff;
  assessment: AssessmentDiff;
  plan: FieldDiff;
}

export interface FieldDiff {
  before: string;
  after: string;
  changed: boolean;
}

export interface AssessmentDiff {
  text: FieldDiff;
  icd10Added: string[];
  icd10Removed: string[];
  changed: boolean;
}
