import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyAppBootstrap } from '../src/app-bootstrap';
import { TestDb } from './support/test-db';

/**
 * These tests load the real ThrottlerGuard (no bypass) to verify rate-limiting
 * and security headers. createTestApp bypasses throttling for other test suites.
 */
async function createHardenedApp(dbUrl: string): Promise<INestApplication> {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = dbUrl;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  applyAppBootstrap(app);
  await app.init();

  process.env.DATABASE_URL = saved;
  return app;
}

describe('Hardening (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await TestDb.start();
    app = await createHardenedApp(testDb.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  }, 30_000);

  describe('Security headers (helmet)', () => {
    it('GET /health includes X-Content-Type-Options header', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('response includes x-frame-options header', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('preflight from allowed origin returns 204 with CORS headers', async () => {
      const res = await request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('preflight from disallowed origin has no CORS allow header', async () => {
      const res = await request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://evil.example.com')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Rate limiting', () => {
    it('login rate limit: 6th request in window → 429', async () => {
      const loginBody = { email: 'admin@demo.clinic', password: 'WrongPass!' };
      const server = app.getHttpServer();

      // Send 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await request(server).post('/auth/login').send(loginBody);
      }

      // 6th should be throttled
      const res = await request(server).post('/auth/login').send(loginBody);
      expect(res.status).toBe(429);
    });
  });
});
