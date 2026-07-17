import { describe, it, expect } from 'vitest';
import {
  createSseStream,
  soapStreamEvents,
  refusedStreamEvents,
  errorStreamEvents,
} from './sseMock';
import type { LlmEvent } from '@contracts';

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

function parseEvents(raw: string): LlmEvent[] {
  return raw
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => {
      const line = chunk.replace(/^data: /, '');
      return JSON.parse(line) as LlmEvent;
    });
}

describe('sseMock', () => {
  it('emits events in order and terminates', async () => {
    const events = soapStreamEvents();
    const stream = createSseStream(events);
    const raw = await collectStream(stream);
    const parsed = parseEvents(raw);
    expect(parsed).toHaveLength(events.length);
    expect(parsed[0]).toMatchObject({ type: 'section-delta', section: 'subjective' });
    expect(parsed[parsed.length - 1]).toMatchObject({ type: 'done' });
  });

  it('emits refused event', async () => {
    const events = refusedStreamEvents();
    const stream = createSseStream(events);
    const raw = await collectStream(stream);
    const parsed = parseEvents(raw);
    expect(parsed[0]).toMatchObject({ type: 'refused' });
  });

  it('emits error event', async () => {
    const events = errorStreamEvents();
    const stream = createSseStream(events);
    const raw = await collectStream(stream);
    const parsed = parseEvents(raw);
    expect(parsed[0]).toMatchObject({ type: 'error' });
  });
});
