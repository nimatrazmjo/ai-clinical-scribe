import { PromptAssembler } from './prompt-assembler';

describe('PromptAssembler', () => {
  let assembler: PromptAssembler;

  beforeEach(() => {
    assembler = new PromptAssembler();
  });

  it('puts transcript in user message, not system prompt (E-25)', () => {
    const ctx = assembler.assemble({
      transcript: 'Patient c/o headache',
      templateBody: null,
    });
    expect(ctx.userMessage).toContain('Patient c/o headache');
    expect(ctx.systemPrompt).not.toContain('Patient c/o headache');
  });

  it('includes template body in system prompt when provided', () => {
    const ctx = assembler.assemble({
      transcript: 'Patient c/o chest pain',
      templateBody: 'Always document vitals first.',
    });
    expect(ctx.systemPrompt).toContain('Always document vitals first.');
  });

  it('does not include template body in user message', () => {
    const ctx = assembler.assemble({
      transcript: 'Patient c/o chest pain',
      templateBody: 'Always document vitals first.',
    });
    expect(ctx.userMessage).not.toContain('Always document vitals first.');
  });

  it('appends tool results to user message when provided', () => {
    const ctx = assembler.assemble({
      transcript: 'Patient c/o cough',
      templateBody: null,
      toolResults: [{ toolName: 'get_patient_history', result: [] }],
    });
    expect(ctx.userMessage).toContain('get_patient_history');
    expect(ctx.userMessage).toContain('[]');
  });
});
