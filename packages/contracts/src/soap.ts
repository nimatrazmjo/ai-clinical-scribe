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
