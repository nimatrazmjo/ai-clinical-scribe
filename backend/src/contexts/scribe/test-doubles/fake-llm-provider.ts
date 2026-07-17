import type { LlmContext, LlmEvent, LlmProvider } from '../domain/ports/llm-provider.port';
import type { GenerationTool } from '../domain/ports/generation-tool.port';

export type FakeScenario =
  | 'clean-soap'
  | 'tool-call'
  | 'malformed-output'
  | 'mid-stream-error'
  | 'refusal';

const CLEAN_SOAP_ASSESSMENT = JSON.stringify({
  text: 'Hypertension noted',
  icd10: [{ code: 'I10', description: 'Essential hypertension' }],
});

export class FakeLlmProvider implements LlmProvider {
  constructor(private readonly scenario: FakeScenario) {}

  async *stream(
    _ctx: LlmContext,
    _tools?: GenerationTool[],
  ): AsyncIterable<LlmEvent> {
    switch (this.scenario) {
      case 'clean-soap':
        yield { type: 'section-delta', section: 'subjective', text: 'Patient c/o headache and dizziness' };
        yield { type: 'section-delta', section: 'objective', text: 'BP 140/90, HR 78, afebrile' };
        yield { type: 'section-delta', section: 'assessment', text: CLEAN_SOAP_ASSESSMENT };
        yield { type: 'section-delta', section: 'plan', text: 'Start lisinopril 10mg daily, follow up in 2 weeks' };
        yield { type: 'done', rawContent: '' };
        break;

      case 'tool-call':
        yield { type: 'tool-call', toolName: 'get_patient_history', args: { patientId: 'demo-patient-id' } };
        yield { type: 'tool-result', toolName: 'get_patient_history', result: [] };
        yield { type: 'section-delta', section: 'subjective', text: 'Patient reports chest pain' };
        yield { type: 'section-delta', section: 'objective', text: 'Vitals stable' };
        yield { type: 'section-delta', section: 'assessment', text: CLEAN_SOAP_ASSESSMENT };
        yield { type: 'section-delta', section: 'plan', text: 'EKG ordered, follow up' };
        yield { type: 'done', rawContent: '' };
        break;

      case 'malformed-output':
        yield { type: 'done', rawContent: 'NOT_JSON_AT_ALL' };
        break;

      case 'mid-stream-error':
        yield { type: 'section-delta', section: 'subjective', text: 'Patient c/o nausea' };
        yield { type: 'error', message: 'LLM stream interrupted unexpectedly' };
        break;

      case 'refusal':
        yield {
          type: 'done',
          rawContent: JSON.stringify({ refused: true, reason: 'No clinical content detected' }),
        };
        break;
    }
  }
}
