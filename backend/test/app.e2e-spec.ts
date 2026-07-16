import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with status and db fields', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      const body = res.body as { status: string; db: string };
      expect(body).toMatchObject({
        status: expect.any(String),
        db: expect.any(String),
      });
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 error envelope (E-45)', async () => {
      const res = await request(app.getHttpServer())
        .get('/no-such-route')
        .expect(404);
      const body = res.body as {
        statusCode: number;
        code: string;
        message: string;
      };
      expect(body).toMatchObject({
        statusCode: 404,
        code: expect.any(String),
        message: expect.any(String),
      });
    });
  });

  describe('Malformed JSON body', () => {
    it('returns 400 error envelope (E-44)', async () => {
      const res = await request(app.getHttpServer())
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{ not: valid json }')
        .expect(400);
      const body = res.body as { statusCode: number };
      expect(body).toMatchObject({ statusCode: 400 });
    });
  });
});
