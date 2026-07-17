import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import type { EmbeddingService } from './embedding-service.port';
import { EMBEDDING_SERVICE } from './embedding-service.port';
import { ICD10_SEED } from './icd10-seed-data';

@Injectable()
export class Icd10SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(Icd10SeedService.name);

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    @Inject(EMBEDDING_SERVICE) private readonly embedder: EmbeddingService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const count = await this.ds.query(
        `SELECT COUNT(*) FROM icd10_codes`,
      ) as [{ count: string }];
      if (parseInt(count[0].count, 10) > 0) return;

      this.logger.log(`Seeding ${ICD10_SEED.length} ICD-10 codes…`);
      for (const entry of ICD10_SEED) {
        const embedding = await this.embedder.embed(entry.description);
        await this.ds.query(
          `INSERT INTO icd10_codes (code, description, embedding)
           VALUES ($1, $2, $3::vector)
           ON CONFLICT (code) DO NOTHING`,
          [entry.code, entry.description, JSON.stringify(embedding)],
        );
      }
      this.logger.log('ICD-10 seed complete');
    } catch (err) {
      this.logger.error('ICD-10 seed failed', err);
    }
  }
}
