import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTemplates1000000000008 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE templates (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            TEXT NOT NULL,
        encounter_type  TEXT NOT NULL DEFAULT 'general',
        prompt_body     TEXT NOT NULL,
        is_active       BOOLEAN NOT NULL DEFAULT false,
        created_by      UUID NOT NULL REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_templates_active ON templates (is_active, encounter_type)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS templates');
  }
}
