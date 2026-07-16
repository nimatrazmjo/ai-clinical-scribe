import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { EnablePgcrypto1000000000000 } from './migrations/1000000000000-EnablePgcrypto';

// CLI data-source for `typeorm migration:run` / `migration:generate`
export default new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  synchronize: false,
  poolSize: 10,
  migrationsTableName: 'migrations',
  migrations: [EnablePgcrypto1000000000000],
  entities: ['src/**/*.entity.ts'],
});
