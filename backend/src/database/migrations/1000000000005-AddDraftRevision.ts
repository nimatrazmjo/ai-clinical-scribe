import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDraftRevision1000000000005 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE note_versions ADD COLUMN draft_revision TEXT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_note_versions_draft_revision ON note_versions (draft_revision) WHERE draft_revision IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_note_versions_draft_revision`,
    );
    await queryRunner.query(
      `ALTER TABLE note_versions DROP COLUMN IF EXISTS draft_revision`,
    );
  }
}
