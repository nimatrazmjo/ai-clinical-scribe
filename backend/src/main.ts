import * as path from 'path';
// Load .env from project root (one level above backend/).
// In dist/main.js __dirname = backend/dist, so ../../.env = project root.
// In ts-node/start:dev __dirname = backend/src, so ../../.env = project root.
// No-op when running in Docker (env vars already injected by compose).
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyAppBootstrap } from './app-bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  applyAppBootstrap(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
