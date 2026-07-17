import { Injectable } from '@nestjs/common';
import type { GuardrailVerdict, OutputGuardrail } from '../ports/output-guardrail.port';

const CLINICAL_KEYWORDS = new Set([
  'pain', 'symptom', 'patient', 'complaint', 'chest', 'headache', 'fever',
  'cough', 'breath', 'nausea', 'vomiting', 'diarrhea', 'fatigue', 'swelling',
  'rash', 'dizzy', 'pressure', 'medication', 'diagnosis', 'history', 'exam',
  'vital', 'blood', 'heart', 'lung', 'abdomen', 'injury', 'infection',
  'treatment', 'follow', 'c/o', 'hx', 'rx', 'sob', 'bp', 'hr', 'temp', 'o2',
]);

@Injectable()
export class EmptyContentGuardrail implements OutputGuardrail {
  check(transcript: string): GuardrailVerdict {
    if (!transcript || !transcript.trim()) {
      return { allowed: false, reason: 'Transcript is empty' };
    }
    if (transcript.trim().length < 20) {
      return { allowed: false, reason: 'Transcript is too short to contain clinical content' };
    }

    const letters = transcript.replace(/[^a-zA-Z]/g, '').length;
    const total = transcript.replace(/\s/g, '').length;
    if (total > 0 && letters / total < 0.6) {
      return { allowed: false, reason: 'Transcript does not appear to contain readable text' };
    }

    const lower = transcript.toLowerCase();
    const hasClinical = [...CLINICAL_KEYWORDS].some((kw) => lower.includes(kw));
    if (!hasClinical) {
      return { allowed: false, reason: 'Transcript contains no recognizable clinical content' };
    }

    return { allowed: true };
  }
}
