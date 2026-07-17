import { Injectable } from '@nestjs/common';
import type { LlmContext } from './ports/llm-provider.port';

const DEFAULT_SYSTEM = `You are a clinical documentation AI. \
Given a clinical encounter transcript, produce a structured SOAP note with four sections: \
Subjective, Objective, Assessment, Plan. \
The Assessment section MUST be a JSON object with shape: \
{"text": "<string>", "icd10": [{"code": "<ICD-10 code>", "description": "<description>"}]}. \
Never fabricate clinical content — if the transcript contains no clinical information, \
respond with: {"refused": true, "reason": "<explanation>"}. \
Never repeat the transcript verbatim in your response.`;

export interface AssembleInput {
  templateBody?: string | null;
  transcript: string;
  toolResults?: Array<{ toolName: string; result: unknown }>;
}

@Injectable()
export class PromptAssembler {
  assemble(input: AssembleInput): LlmContext {
    const systemParts = [DEFAULT_SYSTEM];
    if (input.templateBody) {
      systemParts.push(`\nNote template to follow:\n${input.templateBody}`);
    }

    const userParts = [`Transcript:\n${input.transcript}`];
    if (input.toolResults && input.toolResults.length > 0) {
      const resultText = input.toolResults
        .map((r) => `Tool result for ${r.toolName}:\n${JSON.stringify(r.result, null, 2)}`)
        .join('\n\n');
      userParts.push(`\nAdditional context from tools:\n${resultText}`);
    }

    return {
      systemPrompt: systemParts.join(''),
      userMessage: userParts.join('\n'),
    };
  }
}
