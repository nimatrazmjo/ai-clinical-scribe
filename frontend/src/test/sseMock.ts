import type { LlmEvent } from '@contracts';

function encodeEvent(event: LlmEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSseStream(events: LlmEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      }
      controller.close();
    },
  });
}

export function soapStreamEvents(): LlmEvent[] {
  return [
    { type: 'section-delta', section: 'subjective', text: 'Patient reports chest pain.' },
    { type: 'section-delta', section: 'objective', text: 'BP 140/90, HR 88.' },
    { type: 'section-delta', section: 'assessment', text: 'Hypertension.' },
    { type: 'section-delta', section: 'plan', text: 'Start lisinopril 10mg.' },
    {
      type: 'done',
      rawContent: 'subjective:Patient reports chest pain.\nobjective:BP 140/90, HR 88.\nassessment:Hypertension.\nplan:Start lisinopril 10mg.',
    },
  ];
}

export function refusedStreamEvents(): LlmEvent[] {
  return [
    { type: 'refused', reason: 'Input does not contain clinical content.' },
  ];
}

export function errorStreamEvents(): LlmEvent[] {
  return [
    { type: 'error', message: 'Generation failed: upstream timeout.' },
  ];
}

export function malformedStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {not valid json}\n\n'));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', rawContent: '' })}\n\n`));
      controller.close();
    },
  });
}

export function midStreamError(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(encodeEvent({ type: 'section-delta', section: 'subjective', text: 'Partial...' })),
      );
      controller.enqueue(
        encoder.encode(encodeEvent({ type: 'error', message: 'Connection lost mid-stream.' })),
      );
      controller.close();
    },
  });
}
