export type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan';

export type LlmEvent =
  | { type: 'section-delta'; section: SectionKey; text: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'refused'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'done'; rawContent: string };
