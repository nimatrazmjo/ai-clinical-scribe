import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './support/create-test-app';
import { TestDb } from './support/test-db';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDb;
  let adminToken: string;
  let providerToken: string;

  beforeAll(async () => {
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });

    const admRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.clinic', password: 'AdminPass1!' });
    adminToken = admRes.body.accessToken as string;

    const provRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dr.alice@demo.clinic', password: 'DemoPass1!' });
    providerToken = provRes.body.accessToken as string;
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  }, 30_000);

  describe('POST /admin/providers', () => {
    it('admin creates a provider → 201 with id and role', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'dr.new@demo.clinic',
          firstName: 'New',
          lastName: 'Doc',
          password: 'NewPass1!',
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.role).toBe('provider');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('provider cannot create another provider → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/providers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ email: 'x@y.com', firstName: 'X', lastName: 'Y', password: 'Pass1234!' });
      expect(res.status).toBe(403);
    });

    it('duplicate email → 409', async () => {
      const body = { email: 'dr.dup@demo.clinic', firstName: 'Dup', lastName: 'Doc', password: 'DupPass1!' };
      await request(app.getHttpServer())
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      const res = await request(app.getHttpServer())
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      expect(res.status).toBe(409);
    });
  });

  describe('GET /admin/providers', () => {
    it('admin lists providers → 200 with array', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/providers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((p: { role?: string }) => {
        expect(p).not.toHaveProperty('passwordHash');
      });
    });

    it('provider cannot list providers → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/providers')
        .set('Authorization', `Bearer ${providerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /admin/providers/:id/deactivate', () => {
    it('admin deactivates a provider → 200 ok:true', async () => {
      const created = await request(app.getHttpServer())
        .post('/admin/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'dr.todeact@demo.clinic', firstName: 'Todeact', lastName: 'Doc', password: 'Pass1234!' });
      const id = created.body.id as string;

      const res = await request(app.getHttpServer())
        .patch(`/admin/providers/${id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Verify deactivated user cannot login
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'dr.todeact@demo.clinic', password: 'Pass1234!' });
      expect(loginRes.status).toBe(401);
    });

    it('unknown id → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/providers/00000000-0000-0000-0000-000000000000/deactivate')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /admin/encounters', () => {
    it('admin lists all encounters → 200 array', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/encounters')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('provider cannot list admin encounters → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/encounters')
        .set('Authorization', `Bearer ${providerToken}`);
      expect(res.status).toBe(403);
    });

    it('no auth → 401', async () => {
      const res = await request(app.getHttpServer()).get('/admin/encounters');
      expect(res.status).toBe(401);
    });
  });
});
