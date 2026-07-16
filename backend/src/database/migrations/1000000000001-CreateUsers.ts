import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1000000000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE user_role AS ENUM ('provider', 'admin')
    `);
    await queryRunner.query(`
      CREATE TABLE users (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role         user_role NOT NULL,
        email        TEXT NOT NULL,
        first_name   TEXT NOT NULL,
        last_name    TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_users_email UNIQUE (email)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_users_email ON users (email)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TYPE IF EXISTS user_role');
  }
}
