import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { IdentityModule } from './contexts/identity/identity.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './contexts/auth/auth.module';
import { PatientModule } from './contexts/patient/patient.module';
import { EncounterModule } from './contexts/encounter/encounter.module';
import { TemplateModule } from './contexts/template/template.module';
import { ScribeModule } from './contexts/scribe/scribe.module';
import { CodingModule } from './contexts/coding/coding.module';
import { AdminModule } from './contexts/admin/admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    IdentityModule,
    AuthModule,
    PatientModule,
    EncounterModule,
    TemplateModule,
    ScribeModule,
    CodingModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
