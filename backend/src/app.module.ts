import { Module } from '@nestjs/common';
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
  providers: [],
})
export class AppModule {}
