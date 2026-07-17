import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './support/create-test-app';
import { TestDb } from './support/test-db';

describe('Templates (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDb;
  let providerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    testDb = await TestDb.start();
    app = await createTestApp({ DATABASE_URL: testDb.connectionUri });

    // Login as provider
    const provRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dr.alice@demo.clinic', password: 'DemoPass1!' });
    providerToken = provRes.body.accessToken as string;

    // Login as admin
    const admRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.clinic', password: 'AdminPass1!' });
    adminToken = admRes.body.accessToken as string;
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  }, 30_000);

  it('POST /templates as admin → 201 with id', async () => {
    const res = await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'General SOAP', promptBody: 'Generate a SOAP note.' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.isActive).toBe(false);
  });

  it('POST /templates as provider → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ name: 'Denied', promptBody: 'body' });
    expect(res.status).toBe(403);
  });

  it('GET /templates as provider → only active templates', async () => {
    // Create an active template
    await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Active One', promptBody: 'active body' });

    // List all as admin → can see inactive
    const admRes = await request(app.getHttpServer())
      .get('/templates')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(admRes.status).toBe(200);
    const adminAll = admRes.body as Array<{ isActive: boolean }>;
    const hasInactive = adminAll.some((t) => !t.isActive);
    expect(hasInactive).toBe(true);

    // List as provider → only active
    const provRes = await request(app.getHttpServer())
      .get('/templates')
      .set('Authorization', `Bearer ${providerToken}`);
    expect(provRes.status).toBe(200);
    const provAll = provRes.body as Array<{ isActive: boolean }>;
    provAll.forEach((t) => expect(t.isActive).toBe(true));
  });

  it('PUT /templates/:id as admin → updates isActive; soft DELETE → isActive false (E-34)', async () => {
    // Create
    const createRes = await request(app.getHttpServer())
      .post('/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToUpdate', promptBody: 'original body' });
    const id = createRes.body.id as string;

    // Activate
    const putRes = await request(app.getHttpServer())
      .put(`/templates/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
    expect(putRes.status).toBe(200);
    expect(putRes.body.isActive).toBe(true);

    // Soft delete
    const delRes = await request(app.getHttpServer())
      .delete(`/templates/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(204);

    // findById still has it but isActive = false
    const getRes = await request(app.getHttpServer())
      .get(`/templates/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.isActive).toBe(false);
  });

  it('GET /templates/:id → 404 for unknown id', async () => {
    const res = await request(app.getHttpServer())
      .get('/templates/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('no auth → 401', async () => {
    const res = await request(app.getHttpServer()).get('/templates');
    expect(res.status).toBe(401);
  });
});
