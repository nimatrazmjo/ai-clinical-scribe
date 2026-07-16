import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, TestDb } from '../../test/support';
import { DATA_SOURCE } from './database.module';

describe('DatabaseModule (integration, E-42/E-43)', () => {
  let testDb: TestDb;
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });
    ds = app.get<DataSource>(DATA_SOURCE);
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  }, 30_000);

  it('executes SELECT 1 through the pool', async () => {
    const result = await ds.query('SELECT 1 AS n');
    // TypeORM 1.x / pg returns integer literals as JS numbers
    expect(result[0].n).toBe(1);
  });

  it('resolves the same DataSource singleton on repeated injection (E-43)', () => {
    const ds2 = app.get<DataSource>(DATA_SOURCE);
    expect(ds2).toBe(ds);
  });
});
