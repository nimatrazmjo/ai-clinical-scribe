export interface Icd10Entry {
  code: string;
  description: string;
}

export interface SoapNoteSnapshot {
  subjective: string;
  objective: string;
  assessment: { text: string; icd10: Icd10Entry[] };
  plan: string;
}

export interface FieldDiff {
  changed: boolean;
  from: string;
  to: string;
}

export interface Icd10Diff {
  added: Icd10Entry[];
  removed: Icd10Entry[];
}

export interface SoapNoteDiff {
  subjective: FieldDiff;
  objective: FieldDiff;
  assessmentText: FieldDiff;
  icd10: Icd10Diff;
  plan: FieldDiff;
  hasChanges: boolean;
}

export function diffSoapNotes(from: SoapNoteSnapshot, to: SoapNoteSnapshot): SoapNoteDiff {
  const subjective: FieldDiff = {
    changed: from.subjective !== to.subjective,
    from: from.subjective,
    to: to.subjective,
  };
  const objective: FieldDiff = {
    changed: from.objective !== to.objective,
    from: from.objective,
    to: to.objective,
  };
  const assessmentText: FieldDiff = {
    changed: from.assessment.text !== to.assessment.text,
    from: from.assessment.text,
    to: to.assessment.text,
  };
  const plan: FieldDiff = {
    changed: from.plan !== to.plan,
    from: from.plan,
    to: to.plan,
  };

  const fromCodes = new Set(from.assessment.icd10.map((e) => e.code));
  const toCodes = new Set(to.assessment.icd10.map((e) => e.code));

  const icd10: Icd10Diff = {
    added: to.assessment.icd10.filter((e) => !fromCodes.has(e.code)),
    removed: from.assessment.icd10.filter((e) => !toCodes.has(e.code)),
  };

  const hasChanges =
    subjective.changed ||
    objective.changed ||
    assessmentText.changed ||
    plan.changed ||
    icd10.added.length > 0 ||
    icd10.removed.length > 0;

  return { subjective, objective, assessmentText, icd10, plan, hasChanges };
}
