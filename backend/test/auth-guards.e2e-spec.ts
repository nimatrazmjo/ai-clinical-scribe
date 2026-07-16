import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, TestDb } from './support';
import { DATA_SOURCE } from '../src/database/database.module';
import { PASSWORD_HASHER } from '../src/contexts/identity/password-hasher.port';
import { UserEntity, UserRole } from '../src/contexts/identity/user.entity';
import type { PasswordHasher } from '../src/contexts/identity/password-hasher.port';

const TEST_SECRET = 'guard-e2e-secret';
const TEST_PASSWORD = 'GuardPass1!';

describe('GET /auth/me — JwtAuthGuard + RolesGuard (E-03 through E-08)', () => {
  let testDb: TestDb;
  let app: INestApplication;
  let activeToken: string;
  let adminToken: string;
  let inactiveToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });

    const ds = app.get<DataSource>(DATA_SOURCE);
    const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);
    const hash = await hasher.hash(TEST_PASSWORD);

    const [providerUser, adminUser, inactiveUser] = await ds
      .getRepository(UserEntity)
      .save([
        {
          email: 'provider@guard.clinic',
          firstName: 'Doc',
          lastName: 'Guard',
          role: UserRole.PROVIDER,
          passwordHash: hash,
          isActive: true,
        },
        {
          email: 'admin@guard.clinic',
          firstName: 'Admin',
          lastName: 'Guard',
          role: UserRole.ADMIN,
          passwordHash: hash,
          isActive: true,
        },
        {
          email: 'inactive@guard.clinic',
          firstName: 'Off',
          lastName: 'Guard',
          role: UserRole.PROVIDER,
          passwordHash: hash,
          isActive: false,
        },
      ]);

    const jwtService = new JwtService({});
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 8 * 3600;

    activeToken = await jwtService.signAsync(
      {
        sub: providerUser.id,
        email: providerUser.email,
        role: providerUser.role,
        iat: now,
        exp,
      },
      { secret: TEST_SECRET },
    );

    adminToken = await jwtService.signAsync(
      {
        sub: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        iat: now,
        exp,
      },
      { secret: TEST_SECRET },
    );

    inactiveToken = await jwtService.signAsync(
      {
        sub: inactiveUser.id,
        email: inactiveUser.email,
        role: inactiveUser.role,
        iat: now,
        exp,
      },
      { secret: TEST_SECRET },
    );
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.JWT_SECRET;
  }, 30_000);

  it('returns 200 and user profile for valid token (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${activeToken}`)
      .expect(200);

    const body = res.body as { email: string; role: string };
    expect(body.email).toBe('provider@guard.clinic');
    expect(body.role).toBe(UserRole.PROVIDER);
  });

  it('returns 401 MISSING_TOKEN when Authorization header is absent (E-03)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);

    const body = res.body as { code: string };
    expect(body.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 MISSING_TOKEN when Authorization header has wrong scheme (E-03)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .expect(401);

    const body = res.body as { code: string };
    expect(body.code).toBe('MISSING_TOKEN');
  });

  it('returns 401 INVALID_TOKEN for a malformed JWT (E-04)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer not.a.valid.jwt')
      .expect(401);

    const body = res.body as { code: string };
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 INVALID_TOKEN for a JWT signed with wrong secret (E-04)', async () => {
    const jwtService = new JwtService({});
    const now = Math.floor(Date.now() / 1000);
    const wrongToken = await jwtService.signAsync(
      { sub: 'u-x', email: 'x@x.com', role: 'provider', iat: now, exp: now + 3600 },
      { secret: 'wrong-secret' },
    );

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${wrongToken}`)
      .expect(401);

    const body = res.body as { code: string };
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 TOKEN_EXPIRED for an expired JWT (E-05)', async () => {
    const jwtService = new JwtService({});
    const past = Math.floor(Date.now() / 1000) - 3600;
    const expiredToken = await jwtService.signAsync(
      {
        sub: 'u-past',
        email: 'past@clinic.com',
        role: 'provider',
        iat: past - 3600,
        exp: past,
      },
      { secret: TEST_SECRET },
    );

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    const body = res.body as { code: string };
    expect(body.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 401 ACCOUNT_DEACTIVATED when token is valid but user is inactive (E-06)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${inactiveToken}`)
      .expect(401);

    const body = res.body as { code: string };
    expect(body.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('admin token can access /auth/me (no role restriction on this route)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = res.body as { role: string };
    expect(body.role).toBe(UserRole.ADMIN);
  });
});
