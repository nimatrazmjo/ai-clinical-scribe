import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Clock, IdGenerator } from '../../../shared-kernel';
import {
  CLOCK,
  DomainException,
  EncounterId,
  ID_GENERATOR,
  NoteVersionId,
  UserId,
} from '../../../shared-kernel';
import { Assessment } from '../domain/value-objects/assessment';
import { Icd10Suggestion } from '../domain/value-objects/icd10-suggestion';
import { SoapNote } from '../domain/value-objects/soap-note';
import { EncounterStatus } from '../domain/value-objects/encounter-status';
import { NoteVersion } from '../domain/note-version.aggregate';
import type { NoteVersionRepositoryPort } from '../domain/ports/note-version.repository.port';
import { NOTE_VERSION_REPOSITORY } from '../domain/ports/note-version.repository.port';
import type { EncounterRepositoryPort } from '../domain/ports/encounter.repository.port';
import { ENCOUNTER_REPOSITORY } from '../domain/ports/encounter.repository.port';
import { EncounterRepository } from '../infrastructure/encounter.repository';
import type { SaveNoteDto } from './dto/save-note.dto';
import { AuditRepository } from '../../audit/audit.repository';

export interface SaveNoteResult {
  versionNo: number;
  encounterId: string;
  savedAt: Date;
  savedBy: string;
  draftRevision?: string;
}

@Injectable()
export class SaveNoteVersionUseCase {
  constructor(
    @Inject(NOTE_VERSION_REPOSITORY)
    private readonly noteVersionRepo: NoteVersionRepositoryPort,
    @Inject(ENCOUNTER_REPOSITORY)
    private readonly encounterRepo: EncounterRepositoryPort,
    private readonly encounterRepository: EncounterRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGen: IdGenerator,
    private readonly audit: AuditRepository,
  ) {}

  async execute(
    encounterId: string,
    dto: SaveNoteDto,
    callerId: string,
  ): Promise<SaveNoteResult> {
    const encounter = await this.encounterRepository.findByProviderAndId(
      callerId,
      new EncounterId(encounterId),
    );
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    if (dto.draftRevision) {
      const existing = await this.noteVersionRepo.findByDraftRevision(
        encounterId,
        dto.draftRevision,
      );
      if (existing) {
        return {
          versionNo: existing.versionNo,
          encounterId,
          savedAt: existing.savedAt,
          savedBy: existing.savedBy.value,
          draftRevision: dto.draftRevision,
        };
      }
    }

    let soapNote: SoapNote;
    try {
      const icd10 = dto.soapNote.assessment.icd10.map((c) =>
        Icd10Suggestion.create(c.code, c.description),
      );
      const assessment = Assessment.create(dto.soapNote.assessment.text, icd10);
      soapNote = SoapNote.create(
        dto.soapNote.subjective,
        dto.soapNote.objective,
        assessment,
        dto.soapNote.plan,
      );
    } catch {
      throw new DomainException('Invalid SOAP note structure', 'INVALID_SOAP_NOTE', 422);
    }

    const versionNo = await this.noteVersionRepo.nextVersionNo(encounterId);
    const version = NoteVersion.create(
      new NoteVersionId(this.idGen.uuid()),
      new EncounterId(encounterId),
      versionNo,
      soapNote,
      new UserId(callerId),
      this.clock.now(),
      dto.draftRevision ?? null,
    );

    const saved = await this.noteVersionRepo.append(version);

    if (encounter.status === EncounterStatus.DRAFT) {
      encounter.finalize();
      await this.encounterRepo.save(encounter);
    }

    // Audit — no PHI, only IDs and version number
    await this.audit.record({
      actorId: callerId,
      action: 'NOTE_SAVED',
      entityType: 'encounter',
      entityId: encounterId,
      metadata: { versionNo },
    });

    return {
      versionNo: saved.versionNo,
      encounterId,
      savedAt: saved.savedAt,
      savedBy: saved.savedBy.value,
      draftRevision: dto.draftRevision,
    };
  }
}
