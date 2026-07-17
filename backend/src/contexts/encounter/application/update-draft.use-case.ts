import { Inject, Injectable } from '@nestjs/common';
import { DomainException, EncounterId } from '../../../shared-kernel';
import { ENCOUNTER_REPOSITORY } from '../domain/ports/encounter.repository.port';
import type { EncounterRepositoryPort } from '../domain/ports/encounter.repository.port';
import { EncounterRepository } from '../infrastructure/encounter.repository';
import { EncounterStatus } from '../domain/value-objects/encounter-status';
import type { UpdateDraftDto } from './dto/update-draft.dto';

@Injectable()
export class UpdateDraftUseCase {
  constructor(
    @Inject(ENCOUNTER_REPOSITORY) private readonly repo: EncounterRepositoryPort,
    private readonly encounterRepo: EncounterRepository,
  ) {}

  async execute(
    encounterId: string,
    dto: UpdateDraftDto,
    callerId: string,
  ): Promise<void> {
    const encounter = await this.repo.findById(new EncounterId(encounterId));
    if (!encounter) {
      throw new DomainException('Encounter not found', 'ENCOUNTER_NOT_FOUND', 404);
    }
    if (encounter.providerRef.value !== callerId) {
      throw new DomainException('Forbidden', 'FORBIDDEN', 403);
    }
    if (encounter.status !== EncounterStatus.DRAFT) {
      throw new DomainException(
        'Cannot update draft on a finalized encounter',
        'ENCOUNTER_ALREADY_FINALIZED',
        409,
      );
    }
    await this.encounterRepo.saveRawDraft(encounterId, dto.draft);
  }
}
