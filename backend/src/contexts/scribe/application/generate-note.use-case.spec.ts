import { GenerateNoteUseCase } from './generate-note.use-case';
import { PromptAssembler } from '../domain/prompt-assembler';
import { EmptyContentGuardrail } from '../domain/guardrails/empty-content.guardrail';
import { FakeLlmProvider } from '../test-doubles/fake-llm-provider';
import { DomainException } from '../../../shared-kernel';

const GOOD_TRANSCRIPT =
  'Patient c/o chest pain radiating to left arm. BP 160/100, HR 88. History of hypertension.';

function buildUseCase(scenario: ConstructorParameters<typeof FakeLlmProvider>[0]) {
  return new GenerateNoteUseCase(
    new EmptyContentGuardrail(),
    new PromptAssembler(),
    new FakeLlmProvider(scenario),
  );
}

describe('GenerateNoteUseCase', () => {
  it('returns ok with SoapNote for clean-soap scenario', async () => {
    const result = await buildUseCase('clean-soap').execute({
      transcript: GOOD_TRANSCRIPT,
      encounterId: 'enc-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.soapNote.subjective).toBeTruthy();
      expect(result.soapNote.assessment.icd10.length).toBeGreaterThan(0);
      expect(result.soapNote.assessment.icd10[0].code).toBe('I10');
    }
  });

  it('returns ok for tool-call scenario (history injection)', async () => {
    const result = await buildUseCase('tool-call').execute({
      transcript: GOOD_TRANSCRIPT,
      encounterId: 'enc-1',
    });
    expect(result.ok).toBe(true);
  });

  it('throws GENERATION_PARSE_ERROR for malformed-output', async () => {
    await expect(
      buildUseCase('malformed-output').execute({
        transcript: GOOD_TRANSCRIPT,
        encounterId: 'enc-1',
      }),
    ).rejects.toThrow(DomainException);

    try {
      await buildUseCase('malformed-output').execute({
        transcript: GOOD_TRANSCRIPT,
        encounterId: 'enc-1',
      });
    } catch (e) {
      expect((e as DomainException).code).toBe('GENERATION_PARSE_ERROR');
    }
  });

  it('throws GENERATION_FAILED for mid-stream-error scenario', async () => {
    await expect(
      buildUseCase('mid-stream-error').execute({
        transcript: GOOD_TRANSCRIPT,
        encounterId: 'enc-1',
      }),
    ).rejects.toThrow(DomainException);

    try {
      await buildUseCase('mid-stream-error').execute({
        transcript: GOOD_TRANSCRIPT,
        encounterId: 'enc-1',
      });
    } catch (e) {
      expect((e as DomainException).code).toBe('GENERATION_FAILED');
    }
  });

  it('returns ok:false for refusal scenario', async () => {
    const result = await buildUseCase('refusal').execute({
      transcript: GOOD_TRANSCRIPT,
      encounterId: 'enc-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('returns ok:false when guardrail refuses empty transcript (E-17)', async () => {
    const result = await buildUseCase('clean-soap').execute({
      transcript: '',
      encounterId: 'enc-1',
    });
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when guardrail refuses non-clinical transcript (E-19)', async () => {
    const result = await buildUseCase('clean-soap').execute({
      transcript: 'the quick brown fox jumped over the lazy dog today yes',
      encounterId: 'enc-1',
    });
    expect(result.ok).toBe(false);
  });
});
