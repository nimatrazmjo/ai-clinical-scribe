import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SystemClock } from '../../shared-kernel/implementations/system-clock';
import { CLOCK } from '../../shared-kernel/tokens';
import { PatientIdentityService } from './patient-identity.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    PatientIdentityService,
  ],
  exports: [PatientIdentityService],
})
export class PatientModule {}
