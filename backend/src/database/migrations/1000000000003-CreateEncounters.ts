import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEncounters1000000000003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE encounter_status AS ENUM ('draft', 'finalized')
    `);
    await queryRunner.query(`
      CREATE TABLE encounters (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id            UUID NOT NULL REFERENCES patients(id),
        provider_id           UUID NOT NULL REFERENCES users(id),
        status                encounter_status NOT NULL DEFAULT 'draft',
        current_transcript    TEXT,
        working_draft_json    JSONB,
        selected_template_id  UUID,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_encounters_provider_id ON encounters (provider_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_encounters_patient_id ON encounters (patient_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS encounters');
    await queryRunner.query('DROP TYPE IF EXISTS encounter_status');
  }
}
