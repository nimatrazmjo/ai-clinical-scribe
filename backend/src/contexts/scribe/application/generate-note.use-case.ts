import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '../../../shared-kernel';
import { SoapNote } from '../../encounter/domain/value-objects/soap-note';
import { Assessment } from '../../encounter/domain/value-objects/assessment';
import { Icd10Suggestion } from '../../encounter/domain/value-objects/icd10-suggestion';
import { PromptAssembler } from '../domain/prompt-assembler';
import { EmptyContentGuardrail } from '../domain/guardrails/empty-content.guardrail';
import { LLM_PROVIDER } from '../domain/ports/llm-provider.port';
import type { LlmProvider, SectionKey } from '../domain/ports/llm-provider.port';
import type { GenerationTool } from '../domain/ports/generation-tool.port';

export type GenerateNoteResult =
  | { ok: true; soapNote: SoapNote }
  | { ok: false; reason: string };

export interface GenerateNoteInput {
  transcript: string;
  encounterId: string;
  templateBody?: string | null;
  tools?: GenerationTool[];
}

@Injectable()
export class GenerateNoteUseCase {
  constructor(
    private readonly guardrail: EmptyContentGuardrail,
    private readonly promptAssembler: PromptAssembler,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async execute(input: GenerateNoteInput): Promise<GenerateNoteResult> {
    const verdict = this.guardrail.check(input.transcript);
    if (!verdict.allowed) {
      return { ok: false, reason: verdict.reason };
    }

    const ctx = this.promptAssembler.assemble({
      transcript: input.transcript,
      templateBody: input.templateBody,
    });

    const sections: Partial<Record<SectionKey, string>> = {};
    const toolResults: Array<{ toolName: string; result: unknown }> = [];

    for await (const event of this.llm.stream(ctx, input.tools ?? [])) {
      if (event.type === 'error') {
        throw new DomainException(
          `Generation failed: ${event.message}`,
          'GENERATION_FAILED',
          502,
        );
      }

      if (event.type === 'tool-call') {
        const tool = (input.tools ?? []).find((t) => t.name === event.toolName);
        if (tool) {
          const result = await tool.execute(event.args);
          toolResults.push({ toolName: event.toolName, result });
        }
      }

      if (event.type === 'section-delta') {
        sections[event.section] = (sections[event.section] ?? '') + event.text;
      }

      if (event.type === 'done') {
        if (event.rawContent) {
          try {
            const parsed = JSON.parse(event.rawContent) as Record<string, unknown>;
            if (parsed['refused'] === true) {
              return { ok: false, reason: String(parsed['reason'] ?? 'LLM refused generation') };
            }
          } catch {
            // rawContent is not JSON — not a refusal signal
          }
        }
      }
    }

    const subjective = sections['subjective'] ?? '';
    const objective = sections['objective'] ?? '';
    const assessmentRaw = sections['assessment'] ?? '';
    const plan = sections['plan'] ?? '';

    let assessmentParsed: { text: string; icd10: Array<{ code: string; description: string }> };
    try {
      assessmentParsed = JSON.parse(assessmentRaw) as typeof assessmentParsed;
    } catch {
      throw new DomainException(
        'Failed to parse assessment section from LLM output',
        'GENERATION_PARSE_ERROR',
        502,
      );
    }

    if (!assessmentParsed.icd10 || assessmentParsed.icd10.length === 0) {
      throw new DomainException(
        'LLM output contained no ICD-10 codes',
        'GENERATION_NO_ICD10',
        502,
      );
    }

    const icd10 = assessmentParsed.icd10.map((c) =>
      Icd10Suggestion.create(c.code, c.description),
    );
    const assessment = Assessment.create(assessmentParsed.text, icd10);
    const soapNote = SoapNote.create(subjective, objective, assessment, plan);

    return { ok: true, soapNote };
  }
}
