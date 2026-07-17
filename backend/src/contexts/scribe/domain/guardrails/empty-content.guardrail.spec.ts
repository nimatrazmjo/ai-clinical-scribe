import { EmptyContentGuardrail } from './empty-content.guardrail';

describe('EmptyContentGuardrail', () => {
  let guardrail: EmptyContentGuardrail;

  beforeEach(() => {
    guardrail = new EmptyContentGuardrail();
  });

  it('refuses empty string (E-17)', () => {
    const result = guardrail.check('');
    expect(result.allowed).toBe(false);
  });

  it('refuses whitespace-only string (E-17)', () => {
    const result = guardrail.check('   \n\t  ');
    expect(result.allowed).toBe(false);
  });

  it('refuses strings shorter than 20 chars (E-17)', () => {
    const result = guardrail.check('patient pain');
    expect(result.allowed).toBe(false);
  });

  it('refuses strings with alphabetic ratio below 60% (E-18)', () => {
    const result = guardrail.check('12345 67890 !@#$% 12345 67890 !@#$% !!!');
    expect(result.allowed).toBe(false);
  });

  it('refuses strings with no clinical keywords (E-19)', () => {
    const result = guardrail.check('the quick brown fox jumped over the lazy dog today');
    expect(result.allowed).toBe(false);
  });

  it('allows a transcript with clinical content', () => {
    const transcript = 'Patient presents with chest pain and shortness of breath. BP 140/90.';
    const result = guardrail.check(transcript);
    expect(result.allowed).toBe(true);
  });

  it('allows a transcript using clinical abbreviations (sob, bp, c/o)', () => {
    const transcript = 'Patient c/o sob and dizziness. BP elevated at 150/95. Hx of hypertension.';
    const result = guardrail.check(transcript);
    expect(result.allowed).toBe(true);
  });

  it('allows a transcript mentioning symptoms without abbreviations', () => {
    const transcript = 'Patient complains of severe nausea and vomiting for two days. No fever noted.';
    const result = guardrail.check(transcript);
    expect(result.allowed).toBe(true);
  });
});
