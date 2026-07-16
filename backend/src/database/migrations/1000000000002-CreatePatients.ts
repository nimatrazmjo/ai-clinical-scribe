import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatients1000000000002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE patients (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name   TEXT NOT NULL,
        last_name    TEXT NOT NULL,
        date_of_birth VARCHAR(10) NOT NULL,
        match_key    TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_patients_match_key UNIQUE (match_key)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_patients_match_key ON patients (match_key)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS patients');
  }
}
