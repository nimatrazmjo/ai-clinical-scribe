import { Module } from '@nestjs/common';
import { IdentityModule } from './contexts/identity/identity.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './contexts/auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [DatabaseModule, IdentityModule, AuthModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
