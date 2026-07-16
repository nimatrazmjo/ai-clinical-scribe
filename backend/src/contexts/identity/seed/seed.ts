import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  ALL_ENTITIES,
  ALL_MIGRATIONS,
} from '../../../database/database.module';
import { seedUsers } from './seed-fn';

async function run(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL env var is required to run the seed');

  const ds = new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    entities: ALL_ENTITIES,
    migrations: ALL_MIGRATIONS,
    migrationsTableName: 'migrations',
  });

  await ds.initialize();
  await ds.runMigrations();
  await seedUsers(ds);
  await ds.destroy();
  console.log('Seed complete — 3 providers + 1 admin created (idempotent)');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
