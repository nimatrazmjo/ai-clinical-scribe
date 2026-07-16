import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EncounterRepository } from './infrastructure/encounter.repository';
import { ENCOUNTER_REPOSITORY } from './domain/ports/encounter.repository.port';

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: ENCOUNTER_REPOSITORY, useClass: EncounterRepository },
    EncounterRepository,
  ],
  exports: [ENCOUNTER_REPOSITORY, EncounterRepository],
})
export class EncounterModule {}
