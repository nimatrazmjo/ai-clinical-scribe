import type { GenerationTool } from './generation-tool.port';

export type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan';

export type LlmEvent =
  | { type: 'section-delta'; section: SectionKey; text: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'done'; rawContent: string }
  | { type: 'error'; message: string };

export interface LlmContext {
  systemPrompt: string;
  userMessage: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface LlmProvider {
  stream(ctx: LlmContext, tools?: GenerationTool[]): AsyncIterable<LlmEvent>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';
