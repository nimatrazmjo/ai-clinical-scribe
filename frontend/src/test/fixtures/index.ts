import { UserRole, EncounterStatus } from '@contracts';
import type { AuthMe, EncounterDto, NoteVersionDto, SoapNote, TemplateDto } from '@contracts';

export const demoProviderToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwcm92aWRlci0xIiwiZW1haWwiOiJkcm9zbWl0aEBkZW1vLmNvbSIsInJvbGUiOiJwcm92aWRlciIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.demo';

export const demoAdminToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi0xIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.demo';

export const demoProvider: AuthMe = {
  id: 'provider-1',
  email: 'drsmith@demo.com',
  role: UserRole.Provider,
};

export const demoAdmin: AuthMe = {
  id: 'admin-1',
  email: 'admin@demo.com',
  role: UserRole.Admin,
};

export const demoSoapNote: SoapNote = {
  subjective: 'Patient is a 58-year-old male presenting with chest pain for 2 days.',
  objective: 'BP 145/92, HR 88, RR 16, SpO2 98%. No JVD. Clear lungs.',
  assessment: {
    text: 'Essential hypertension, uncontrolled.',
    icd10: [{ code: 'I10', description: 'Essential (primary) hypertension', score: 0.97 }],
  },
  plan: 'Start lisinopril 10mg daily. Follow up in 2 weeks. Low-sodium diet counseling.',
};

export const demoEncounter: EncounterDto = {
  id: 'encounter-1',
  status: EncounterStatus.Draft,
  patientFirstName: 'John',
  patientLastName: 'Doe',
  patientDateOfBirth: '1966-03-15',
  transcript: 'Patient reports chest pain for 2 days...',
  draft: null,
  draftRevision: 0,
  templateId: null,
  providerId: 'provider-1',
  createdAt: '2026-07-17T10:00:00.000Z',
  updatedAt: '2026-07-17T10:00:00.000Z',
};

export const demoFinalizedEncounter: EncounterDto = {
  ...demoEncounter,
  id: 'encounter-2',
  status: EncounterStatus.Finalized,
  draft: demoSoapNote,
};

export const demoNoteVersion: NoteVersionDto = {
  id: 'version-1',
  encounterId: 'encounter-1',
  versionNumber: 1,
  soapNote: demoSoapNote,
  savedById: 'provider-1',
  savedByEmail: 'drsmith@demo.com',
  createdAt: '2026-07-17T11:00:00.000Z',
};

export const demoTemplate: TemplateDto = {
  id: 'template-1',
  name: 'Standard SOAP',
  promptBody: 'Generate a detailed SOAP note from the following transcript.',
  encounterType: null,
  isActive: true,
  createdAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:00:00.000Z',
};
