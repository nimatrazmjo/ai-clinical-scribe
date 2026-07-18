import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES, ALL_MIGRATIONS } from './database/database.module';

// Standalone migration runner, invoked as `node dist/migrate` by the one-off
// ECS migration task (see infra/deploy/ecs/migration-task-definition.json).
//
// A Postgres session-level advisory lock serializes concurrent runners: if two
// migration tasks ever overlap, one applies the migrations and the other blocks,
// then finds nothing pending. Backward-compatible (expand/contract) migrations
// keep this safe alongside a rolling image deploy.
const MIGRATION_LOCK_KEY = 4967295;

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    poolSize: 2,
    entities: ALL_ENTITIES,
    migrationsTableName: 'migrations',
    migrations: ALL_MIGRATIONS,
  });

  await dataSource.initialize();

  // Hold the lock on a dedicated connection for the whole run.
  const lock = dataSource.createQueryRunner();
  await lock.connect();

  try {
    await lock.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);

    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length > 0
        ? `Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(', ')}`
        : 'No pending migrations.',
    );
  } finally {
    await lock.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    await lock.release();
    await dataSource.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
