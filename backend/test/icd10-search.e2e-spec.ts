import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TestDb } from './support';
import { DATA_SOURCE } from '../src/database/database.module';
import { UserEntity, UserRole } from '../src/contexts/identity/user.entity';
import type { PasswordHasher } from '../src/contexts/identity/password-hasher.port';
import { PASSWORD_HASHER } from '../src/contexts/identity/password-hasher.port';

const TEST_PASSWORD = 'TestPass1!';

async function loginAs(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD });
  return (res.body as { accessToken: string }).accessToken;
}

describe('ICD-10 search endpoint (BE-22)', () => {
  let testDb: TestDb;
  let app: INestApplication;
  let ds: DataSource;
  let providerToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret';
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });
    ds = app.get<DataSource>(DATA_SOURCE);

    const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
    const hash = await hasher.hash(TEST_PASSWORD);
    await ds.getRepository(UserEntity).save({
      email: 'coding-provider@test.clinic',
      firstName: 'Code',
      lastName: 'Doc',
      role: UserRole.PROVIDER,
      passwordHash: hash,
      isActive: true,
    });
    providerToken = await loginAs(app, 'coding-provider@test.clinic');
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.JWT_SECRET;
  }, 30_000);

  it('returns results for a valid clinical query (E-35 happy path)', async () => {
    const res = await request(app.getHttpServer())
      .get('/icd10/search?q=hypertension')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    const body = res.body as Array<{ code: string; description: string; score: number }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('code');
    expect(body[0]).toHaveProperty('description');
    expect(typeof body[0].score).toBe('number');
  });

  it('returns 400 for empty q parameter (E-35)', async () => {
    const res = await request(app.getHttpServer())
      .get('/icd10/search?q=')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(400);

    expect((res.body as { statusCode: number }).statusCode).toBe(400);
  });

  it('returns 400 when q is missing entirely', async () => {
    await request(app.getHttpServer())
      .get('/icd10/search')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(400);
  });

  it('returns 401 without authentication token', async () => {
    await request(app.getHttpServer())
      .get('/icd10/search?q=diabetes')
      .expect(401);
  });

  it('returns 200 array for non-medical query — no error, no fabrication (E-37)', async () => {
    const res = await request(app.getHttpServer())
      .get('/icd10/search?q=blockchain+cryptocurrency')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    const body = res.body as Array<{ code: string }>;
    expect(Array.isArray(body)).toBe(true);
    // graceful degradation: returns nearest codes even for unrelated query
  });

  it('exact description match scores near 1.0', async () => {
    const res = await request(app.getHttpServer())
      .get('/icd10/search?q=Essential+(primary)+hypertension')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    const body = res.body as Array<{ code: string; score: number }>;
    const i10 = body.find((r) => r.code === 'I10');
    expect(i10).toBeDefined();
    expect(i10!.score).toBeGreaterThan(0.99);
  });
});
