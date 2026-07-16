import { Controller, Get, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../database/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  @Get()
  async check(): Promise<{ status: string; db: string }> {
    try {
      await this.ds.query('SELECT 1');
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'degraded', db: 'down' };
    }
  }
}
