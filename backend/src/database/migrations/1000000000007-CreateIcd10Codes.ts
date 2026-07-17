import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIcd10Codes1000000000007 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`
      CREATE TABLE icd10_codes (
        code        TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        embedding   vector(1536) NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_icd10_embedding
        ON icd10_codes
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 10)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS icd10_codes`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
