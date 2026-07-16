import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TestDb } from './support';
import { DATA_SOURCE } from '../src/database/database.module';
import { PASSWORD_HASHER } from '../src/contexts/identity/password-hasher.port';
import { UserEntity, UserRole } from '../src/contexts/identity/user.entity';
import type { PasswordHasher } from '../src/contexts/identity/password-hasher.port';

const TEST_PASSWORD = 'TestPass1!';
const ACTIVE_EMAIL = 'active@test.clinic';
const INACTIVE_EMAIL = 'inactive@test.clinic';

describe('POST /auth/login (E-01)', () => {
  let testDb: TestDb;
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret';
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });

    const ds = app.get<DataSource>(DATA_SOURCE);
    const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
    const hash = await hasher.hash(TEST_PASSWORD);

    await ds.getRepository(UserEntity).save([
      {
        email: ACTIVE_EMAIL,
        firstName: 'Active',
        lastName: 'Test',
        role: UserRole.PROVIDER,
        passwordHash: hash,
        isActive: true,
      },
      {
        email: INACTIVE_EMAIL,
        firstName: 'Inactive',
        lastName: 'Test',
        role: UserRole.PROVIDER,
        passwordHash: hash,
        isActive: false,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.JWT_SECRET;
  }, 30_000);

  it('returns 200 and a JWT for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ACTIVE_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    const body = res.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.split('.').length).toBe(3);
  });

  it('returns identical 401 body for unknown email vs wrong password (E-01 no enumeration)', async () => {
    const unknownRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@test.clinic', password: TEST_PASSWORD })
      .expect(401);

    const wrongPwdRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ACTIVE_EMAIL, password: 'WrongPass!' })
      .expect(401);

    expect(JSON.stringify(wrongPwdRes.body)).toBe(
      JSON.stringify(unknownRes.body),
    );
  });

  it('returns 401 for deactivated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: INACTIVE_EMAIL, password: TEST_PASSWORD })
      .expect(401);

    const body = res.body as { code: string };
    expect(body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 400 for invalid email format', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: TEST_PASSWORD })
      .expect(400);
  });

  it('returns 400 for missing password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ACTIVE_EMAIL })
      .expect(400);
  });
});
