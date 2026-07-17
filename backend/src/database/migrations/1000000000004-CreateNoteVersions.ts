import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNoteVersions1000000000004 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE note_versions (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        encounter_id  UUID NOT NULL REFERENCES encounters(id),
        version_no    INTEGER NOT NULL,
        content_json  JSONB NOT NULL,
        saved_by      UUID NOT NULL REFERENCES users(id),
        saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_note_versions_encounter_version UNIQUE (encounter_id, version_no)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_note_versions_encounter_version ON note_versions (encounter_id, version_no)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS note_versions');
  }
}
