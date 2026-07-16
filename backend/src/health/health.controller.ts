import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; db: string } {
    return { status: 'ok', db: 'unknown' };
  }
}
