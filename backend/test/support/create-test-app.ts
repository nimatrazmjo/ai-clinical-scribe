import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { applyAppBootstrap } from '../../src/app-bootstrap';

export async function createTestApp(
  env: Record<string, string> = {},
): Promise<INestApplication> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(APP_GUARD)
    .useValue({ canActivate: () => true })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  applyAppBootstrap(app);
  await app.init();

  // Restore env after init so tests don't leak
  for (const [k, original] of Object.entries(saved)) {
    if (original === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = original;
    }
  }

  return app;
}
