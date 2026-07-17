/**
 * BE-19: Expired-session save, no data loss (E-32)
 *
 * Proves the backend contract:
 * 1. Draft is persisted server-side before expiry → zero data loss on token expiry
 * 2. Expired token at save-time returns 401 TOKEN_EXPIRED (not a generic 401)
 * 3. Re-auth + replay with draftRevision → exactly one version, no duplicate
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TestDb } from './support';
import { DATA_SOURCE } from '../src/database/database.module';
import { UserEntity, UserRole } from '../src/contexts/identity/user.entity';
import type { PasswordHasher } from '../src/contexts/identity/password-hasher.port';
import { PASSWORD_HASHER } from '../src/contexts/identity/password-hasher.port';

const TEST_PASSWORD = 'TestPass1!';
const JWT_SECRET = 'e2e-test-secret';

const validSoap = {
  subjective: 'Patient c/o sore throat',
  objective: 'Temp 38.2C, red pharynx',
  assessment: {
    text: 'Acute pharyngitis',
    icd10: [{ code: 'J02.9', description: 'Acute pharyngitis, unspecified' }],
  },
  plan: 'Throat lozenges, rest, follow-up PRN',
};

async function loginAs(
  app: INestApplication,
  email: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD });
  return (res.body as { accessToken: string }).accessToken;
}

describe('Expired session save — no data loss (E-32, BE-19)', () => {
  let testDb: TestDb;
  let app: INestApplication;
  let ds: DataSource;
  let providerToken: string;
  let userId: string;
  let userEmail: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });
    ds = app.get<DataSource>(DATA_SOURCE);

    const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
    const hash = await hasher.hash(TEST_PASSWORD);
    userEmail = 'expired-test@clinic.test';

    const savedUser = await ds.getRepository(UserEntity).save({
      email: userEmail,
      firstName: 'Expired',
      lastName: 'Test',
      role: UserRole.PROVIDER,
      passwordHash: hash,
      isActive: true,
    });
    userId = savedUser.id;

    providerToken = await loginAs(app, userEmail);
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.JWT_SECRET;
  }, 30_000);

  it('expired token returns 401 TOKEN_EXPIRED and draft is intact (E-32)', async () => {
    // Start an encounter with a valid token
    const encRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ firstName: 'Bob', lastName: 'Patient', dateOfBirth: '1975-03-20' })
      .expect(201);
    const encId = (encRes.body as { id: string }).id;

    // Autosave a draft (simulates BE-11 autosave keeping data server-side)
    const draftPayload = {
      draft: {
        subjective: validSoap.subjective,
        objective: validSoap.objective,
        assessment: validSoap.assessment,
        plan: validSoap.plan,
      },
    };
    await request(app.getHttpServer())
      .patch(`/encounters/${encId}/draft`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send(draftPayload)
      .expect(200);

    // Craft an expired JWT (exp = 1 hour ago)
    const jwtService = app.get(JwtService);
    const expiredToken = jwtService.sign(
      {
        sub: userId,
        email: userEmail,
        role: 'provider',
        exp: Math.floor(Date.now() / 1000) - 3600,
      },
      { secret: JWT_SECRET },
    );

    // Save attempt with expired token → 401 TOKEN_EXPIRED
    const saveRes = await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ soapNote: validSoap, draftRevision: 'dr-expired-test-001' })
      .expect(401);

    const body = saveRes.body as { code: string };
    expect(body.code).toBe('TOKEN_EXPIRED');

    // Draft is still intact (no data loss) — verify via valid token
    const getRes = await request(app.getHttpServer())
      .get(`/encounters/${encId}`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    const enc = getRes.body as { workingDraft: unknown };
    // workingDraft was saved by autosave and is still there
    expect(enc.workingDraft).not.toBeNull();
  });

  it('re-auth and replay with draftRevision creates exactly one version', async () => {
    const encRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ firstName: 'Carol', lastName: 'Replay', dateOfBirth: '1988-11-05' })
      .expect(201);
    const encId = (encRes.body as { id: string }).id;

    const draftRevision = 'dr-idempotent-replay-999';

    // First save succeeds with valid token
    const r1 = await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ soapNote: validSoap, draftRevision })
      .expect(201);

    expect((r1.body as { versionNo: number }).versionNo).toBe(1);

    // Replay (simulate re-auth and re-send same draftRevision) → same version, no duplicate
    const freshToken = await loginAs(app, userEmail);
    const r2 = await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ soapNote: validSoap, draftRevision })
      .expect(201);

    expect((r2.body as { versionNo: number }).versionNo).toBe(1);

    // Only one version in history
    const historyRes = await request(app.getHttpServer())
      .get(`/encounters/${encId}/versions`)
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200);

    expect((historyRes.body as unknown[]).length).toBe(1);
  });

  it('generic expired read on any route returns TOKEN_EXPIRED (consistency with BE-07)', async () => {
    const jwtService = app.get(JwtService);
    const expiredToken = jwtService.sign(
      {
        sub: userId,
        email: userEmail,
        role: 'provider',
        exp: Math.floor(Date.now() / 1000) - 3600,
      },
      { secret: JWT_SECRET },
    );

    const res = await request(app.getHttpServer())
      .get('/encounters')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    expect((res.body as { code: string }).code).toBe('TOKEN_EXPIRED');
  });
});
