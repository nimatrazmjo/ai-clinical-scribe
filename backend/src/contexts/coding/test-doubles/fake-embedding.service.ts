import { createHash } from 'crypto';
import type { EmbeddingService } from '../embedding-service.port';

// Deterministic 1536-d unit vector derived from text hash.
// Used in tests and local seed so no OpenAI calls are needed.
export class FakeEmbeddingService implements EmbeddingService {
  async embed(text: string): Promise<number[]> {
    const hash = createHash('sha256').update(text).digest();
    const raw: number[] = [];
    for (let i = 0; i < 1536; i++) {
      raw.push((hash[i % 32] / 255) * 2 - 1);
    }
    const magnitude = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
    return raw.map((v) => v / magnitude);
  }
}
