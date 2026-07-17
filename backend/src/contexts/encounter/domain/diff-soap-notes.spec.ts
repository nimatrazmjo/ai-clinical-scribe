import { diffSoapNotes, SoapNoteSnapshot } from './diff-soap-notes';

const base: SoapNoteSnapshot = {
  subjective: 'Patient reports chest pain.',
  objective: 'BP 140/90, HR 80.',
  assessment: {
    text: 'Hypertension.',
    icd10: [{ code: 'I10', description: 'Essential hypertension' }],
  },
  plan: 'Continue lisinopril 10mg.',
};

describe('diffSoapNotes', () => {
  it('returns hasChanges=false when notes are identical', () => {
    const result = diffSoapNotes(base, { ...base, assessment: { ...base.assessment } });
    expect(result.hasChanges).toBe(false);
    expect(result.subjective.changed).toBe(false);
    expect(result.icd10.added).toHaveLength(0);
    expect(result.icd10.removed).toHaveLength(0);
  });

  it('detects subjective change', () => {
    const to = { ...base, subjective: 'Patient now reports shortness of breath.' };
    const result = diffSoapNotes(base, to);
    expect(result.subjective.changed).toBe(true);
    expect(result.subjective.from).toBe(base.subjective);
    expect(result.subjective.to).toBe(to.subjective);
    expect(result.hasChanges).toBe(true);
  });

  it('detects objective change', () => {
    const to = { ...base, objective: 'BP 120/80, HR 72.' };
    const result = diffSoapNotes(base, to);
    expect(result.objective.changed).toBe(true);
    expect(result.hasChanges).toBe(true);
  });

  it('detects assessment text change', () => {
    const to = {
      ...base,
      assessment: { ...base.assessment, text: 'Controlled hypertension.' },
    };
    const result = diffSoapNotes(base, to);
    expect(result.assessmentText.changed).toBe(true);
    expect(result.hasChanges).toBe(true);
  });

  it('detects plan change', () => {
    const to = { ...base, plan: 'Add amlodipine 5mg.' };
    const result = diffSoapNotes(base, to);
    expect(result.plan.changed).toBe(true);
    expect(result.hasChanges).toBe(true);
  });

  it('detects ICD-10 code added', () => {
    const to = {
      ...base,
      assessment: {
        ...base.assessment,
        icd10: [
          ...base.assessment.icd10,
          { code: 'E11', description: 'Type 2 diabetes mellitus' },
        ],
      },
    };
    const result = diffSoapNotes(base, to);
    expect(result.icd10.added).toHaveLength(1);
    expect(result.icd10.added[0].code).toBe('E11');
    expect(result.icd10.removed).toHaveLength(0);
    expect(result.hasChanges).toBe(true);
  });

  it('detects ICD-10 code removed', () => {
    const to = {
      ...base,
      assessment: { ...base.assessment, icd10: [] },
    };
    const result = diffSoapNotes(base, to);
    expect(result.icd10.removed).toHaveLength(1);
    expect(result.icd10.removed[0].code).toBe('I10');
    expect(result.icd10.added).toHaveLength(0);
    expect(result.hasChanges).toBe(true);
  });

  it('handles ICD-10 swap (same count, different codes)', () => {
    const to = {
      ...base,
      assessment: {
        ...base.assessment,
        icd10: [{ code: 'J45', description: 'Asthma' }],
      },
    };
    const result = diffSoapNotes(base, to);
    expect(result.icd10.added).toHaveLength(1);
    expect(result.icd10.removed).toHaveLength(1);
  });

  it('reports from and to for all unchanged fields', () => {
    const to = { ...base, plan: 'New plan.' };
    const result = diffSoapNotes(base, to);
    expect(result.subjective.from).toBe(base.subjective);
    expect(result.subjective.to).toBe(base.subjective);
    expect(result.objective.changed).toBe(false);
  });
});
