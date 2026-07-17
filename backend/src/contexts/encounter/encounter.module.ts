import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PatientModule } from '../patient/patient.module';
import { AuthModule } from '../auth/auth.module';
import { SystemClock } from '../../shared-kernel/implementations/system-clock';
import { UuidGenerator } from '../../shared-kernel/implementations/uuid-generator';
import { CLOCK, ID_GENERATOR } from '../../shared-kernel/tokens';
import { EncounterRepository } from './infrastructure/encounter.repository';
import { ENCOUNTER_REPOSITORY } from './domain/ports/encounter.repository.port';
import { NoteVersionRepository } from './infrastructure/note-version.repository';
import { NOTE_VERSION_REPOSITORY } from './domain/ports/note-version.repository.port';
import { StartEncounterUseCase } from './application/start-encounter.use-case';
import { UpdateDraftUseCase } from './application/update-draft.use-case';
import { SaveNoteVersionUseCase } from './application/save-note-version.use-case';
import { AuditModule } from '../audit/audit.module';
import { EncounterController } from './interface/encounter.controller';

@Module({
  imports: [DatabaseModule, PatientModule, AuthModule, AuditModule],
  providers: [
    { provide: ENCOUNTER_REPOSITORY, useClass: EncounterRepository },
    EncounterRepository,
    { provide: NOTE_VERSION_REPOSITORY, useClass: NoteVersionRepository },
    NoteVersionRepository,
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    StartEncounterUseCase,
    UpdateDraftUseCase,
    SaveNoteVersionUseCase,
  ],
  controllers: [EncounterController],
  exports: [ENCOUNTER_REPOSITORY, EncounterRepository, NOTE_VERSION_REPOSITORY, NoteVersionRepository],
})
export class EncounterModule {}
