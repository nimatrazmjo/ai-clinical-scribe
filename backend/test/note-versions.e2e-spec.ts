import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TestDb } from './support';
import { DATA_SOURCE } from '../src/database/database.module';
import { UserEntity, UserRole } from '../src/contexts/identity/user.entity';
import type { PasswordHasher } from '../src/contexts/identity/password-hasher.port';
import { PASSWORD_HASHER } from '../src/contexts/identity/password-hasher.port';

const TEST_PASSWORD = 'TestPass1!';

const validSoap = {
  subjective: 'Patient c/o chest pain x2 days',
  objective: 'BP 120/80, HR 72',
  assessment: {
    text: 'Chest pain, likely musculoskeletal',
    icd10: [{ code: 'R07.9', description: 'Chest pain, unspecified' }],
  },
  plan: 'NSAIDs, follow-up in 1 week',
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

async function createEncounter(
  app: INestApplication,
  token: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/encounters')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Alice',
      lastName: 'Smith',
      dateOfBirth: '1990-06-15',
    })
    .expect(201);
  return (res.body as { id: string }).id;
}

describe('Note Versions (BE-18)', () => {
  let testDb: TestDb;
  let app: INestApplication;
  let ds: DataSource;
  let providerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret';
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });
    ds = app.get<DataSource>(DATA_SOURCE);

    const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
    const hash = await hasher.hash(TEST_PASSWORD);

    await ds.getRepository(UserEntity).save([
      {
        email: 'provider-nv@test.clinic',
        firstName: 'Provider',
        lastName: 'NV',
        role: UserRole.PROVIDER,
        passwordHash: hash,
        isActive: true,
      },
      {
        email: 'other-nv@test.clinic',
        firstName: 'Other',
        lastName: 'NV',
        role: UserRole.PROVIDER,
        passwordHash: hash,
        isActive: true,
      },
    ]);

    providerToken = await loginAs(app, 'provider-nv@test.clinic');
    otherToken = await loginAs(app, 'other-nv@test.clinic');
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.JWT_SECRET;
  }, 30_000);

  it('saves a note and returns version 1 (E-28)', async () => {
    const encId = await createEncounter(app, providerToken);
    const res = await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ soapNote: validSoap })
      .expect(201);

    const body = res.body as { versionNo: number; encounterId: string };
    expect(body.versionNo).toBe(1);
    expect(body.encounterId).toBe(encId);
  });

  it('lists versions after save', async () => {
    const encId = await createEncounter(app, providerToken);
    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ soapNote: validSoap })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/encounters/${encId}/versions`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    const body = res.body as Array<{ versionNo: number }>;
    expect(body).toHaveLength(1);
    expect(body[0].versionNo).toBe(1);
  });

  it('retrieves a specific version by number', async () => {
    const encId = await createEncounter(app, providerToken);
    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ soapNote: validSoap })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/encounters/${encId}/versions/1`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);

    const body = res.body as { versionNo: number; content: { subjective: string } };
    expect(body.versionNo).toBe(1);
    expect(body.content.subjective).toBe(validSoap.subjective);
  });

  it('idempotent save with draftRevision — no duplicate version', async () => {
    const encId = await createEncounter(app, providerToken);
    const dto = { soapNote: validSoap, draftRevision: 'unique-rev-abc-123' };

    const r1 = await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send(dto)
      .expect(201);

    const r2 = await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send(dto)
      .expect(201);

    expect((r1.body as { versionNo: number }).versionNo).toBe(
      (r2.body as { versionNo: number }).versionNo,
    );

    const versions = await request(app.getHttpServer())
      .get(`/encounters/${encId}/versions`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);
    expect((versions.body as unknown[]).length).toBe(1);
  });

  it('non-owner cannot save a note (E-07)', async () => {
    const encId = await createEncounter(app, providerToken);
    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ soapNote: validSoap })
      .expect(404);
  });

  it('non-owner cannot list versions (E-07)', async () => {
    const encId = await createEncounter(app, providerToken);
    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ soapNote: validSoap })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/encounters/${encId}/versions`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('unknown version returns 404', async () => {
    const encId = await createEncounter(app, providerToken);
    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ soapNote: validSoap })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/encounters/${encId}/versions/99`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(404);
  });
});
