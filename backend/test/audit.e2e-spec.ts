import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TestDb } from './support';
import { DATA_SOURCE } from '../src/database/database.module';
import { UserEntity, UserRole } from '../src/contexts/identity/user.entity';
import { AuditEntryOrmEntity } from '../src/contexts/audit/audit-entry.orm-entity';
import type { PasswordHasher } from '../src/contexts/identity/password-hasher.port';
import { PASSWORD_HASHER } from '../src/contexts/identity/password-hasher.port';

const TEST_PASSWORD = 'TestPass1!';

const validSoap = {
  subjective: 'Patient c/o fatigue',
  objective: 'BP 118/76, HR 68',
  assessment: {
    text: 'Fatigue, likely viral',
    icd10: [{ code: 'R53.83', description: 'Other fatigue' }],
  },
  plan: 'Rest and fluids',
};

async function loginAs(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: TEST_PASSWORD });
  return (res.body as { accessToken: string }).accessToken;
}

describe('Audit log (BE-20)', () => {
  let testDb: TestDb;
  let app: INestApplication;
  let ds: DataSource;
  let providerToken: string;
  let providerId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret';
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });
    ds = app.get<DataSource>(DATA_SOURCE);

    const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
    const hash = await hasher.hash(TEST_PASSWORD);

    const user = await ds.getRepository(UserEntity).save({
      email: 'audit-provider@test.clinic',
      firstName: 'Audit',
      lastName: 'Doc',
      role: UserRole.PROVIDER,
      passwordHash: hash,
      isActive: true,
    });
    providerId = user.id;
    providerToken = await loginAs(app, 'audit-provider@test.clinic');
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.JWT_SECRET;
  }, 30_000);

  it('login produces a USER_AUTHENTICATED audit entry (no PHI)', async () => {
    const rows = await ds.getRepository(AuditEntryOrmEntity).find({
      where: { actorId: providerId, action: 'USER_AUTHENTICATED' },
    });

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const entry = rows[0];
    expect(entry.entityType).toBe('user');
    expect(entry.entityId).toBe(providerId);
    // metadata must be empty — no email, no password
    expect(JSON.stringify(entry.metadata)).not.toMatch(/email|password|hash/i);
  });

  it('note save produces a NOTE_SAVED audit entry with versionNo (no PHI)', async () => {
    const encRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ firstName: 'Bob', lastName: 'Jones', dateOfBirth: '1985-03-20' })
      .expect(201);
    const encId = (encRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ soapNote: validSoap })
      .expect(201);

    const rows = await ds.getRepository(AuditEntryOrmEntity).find({
      where: { actorId: providerId, action: 'NOTE_SAVED', entityId: encId },
    });

    expect(rows).toHaveLength(1);
    const entry = rows[0];
    expect(entry.entityType).toBe('encounter');
    expect(entry.metadata['versionNo']).toBe(1);
    // no clinical text in metadata
    const metaStr = JSON.stringify(entry.metadata);
    expect(metaStr).not.toMatch(/fatigue|patient|bp|fluids|R53/i);
  });

  it('idempotent note save (draftRevision replay) does NOT produce a duplicate audit entry', async () => {
    const encRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ firstName: 'Carol', lastName: 'King', dateOfBirth: '1970-11-05' })
      .expect(201);
    const encId = (encRes.body as { id: string }).id;

    const dto = { soapNote: validSoap, draftRevision: 'audit-idem-rev-001' };

    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send(dto)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/encounters/${encId}/notes`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send(dto)
      .expect(201);

    const rows = await ds.getRepository(AuditEntryOrmEntity).find({
      where: { actorId: providerId, action: 'NOTE_SAVED', entityId: encId },
    });
    expect(rows).toHaveLength(1);
  });
});
