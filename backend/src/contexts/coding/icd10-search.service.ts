import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import type { EmbeddingService } from './embedding-service.port';
import { EMBEDDING_SERVICE } from './embedding-service.port';

export interface Icd10Match {
  code: string;
  description: string;
  score: number;
}

@Injectable()
export class Icd10SearchService {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    @Inject(EMBEDDING_SERVICE) private readonly embedder: EmbeddingService,
  ) {}

  async searchSemantic(query: string, k = 10): Promise<Icd10Match[]> {
    const embedding = await this.embedder.embed(query);
    const rows = await this.ds.query(
      `SELECT code, description, 1 - (embedding <=> $1::vector) AS score
         FROM icd10_codes
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
      [JSON.stringify(embedding), k],
    ) as Array<{ code: string; description: string; score: string }>;

    return rows.map((r) => ({
      code: r.code,
      description: r.description,
      score: parseFloat(r.score),
    }));
  }
}
