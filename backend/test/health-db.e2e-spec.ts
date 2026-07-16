import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestDb } from './support';

describe('GET /health with live DB (E-42)', () => {
  let testDb: TestDb;
  let app: INestApplication;

  beforeAll(async () => {
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  }, 30_000);

  it('returns { status: ok, db: up } when DB is reachable (E-42)', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    const body = res.body as { status: string; db: string };
    expect(body).toEqual({ status: 'ok', db: 'up' });
  });
});
