export interface Icd10Suggestion {
  code: string;
  description: string;
  score: number;
}

export interface Assessment {
  text: string;
  icd10: Icd10Suggestion[];
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: Assessment;
  plan: string;
}

// ── Saved (persisted) variant ────────────────────────────────────────────
// `score` is an AI-suggestion confidence value - meaningful while a code is
// still a live suggestion, meaningless once a human has curated and saved
// it. The save-note endpoint's validation DTO already treats it as optional
// (backend/src/contexts/encounter/application/dto/save-note.dto.ts); these
// types make that the shared contract instead of two definitions drifting.
export interface SavedIcd10Code {
  code: string;
  description: string;
  score?: number;
}

export interface SavedAssessment {
  text: string;
  icd10: SavedIcd10Code[];
}

export interface SavedSoapNote extends Omit<SoapNote, 'assessment'> {
  assessment: SavedAssessment;
}
