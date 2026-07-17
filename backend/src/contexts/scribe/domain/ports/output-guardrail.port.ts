export type GuardrailVerdict = { allowed: true } | { allowed: false; reason: string };

export interface OutputGuardrail {
  check(transcript: string): GuardrailVerdict;
}
