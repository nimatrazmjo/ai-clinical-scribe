import { Inject, Injectable } from '@nestjs/common';
import { PatientIdentityService } from '../../patient/patient-identity.service';
import { ENCOUNTER_REPOSITORY } from '../domain/ports/encounter.repository.port';
import type { EncounterRepositoryPort } from '../domain/ports/encounter.repository.port';
import { Encounter } from '../domain/encounter.aggregate';
import { EncounterId, TemplateId, UserId, ID_GENERATOR, CLOCK } from '../../../shared-kernel';
import type { IdGenerator } from '../../../shared-kernel';
import type { Clock } from '../../../shared-kernel';
import type { StartEncounterDto } from './dto/start-encounter.dto';
import { PatientId } from '../../../shared-kernel';

@Injectable()
export class StartEncounterUseCase {
  constructor(
    private readonly patientIdentityService: PatientIdentityService,
    @Inject(ENCOUNTER_REPOSITORY) private readonly repo: EncounterRepositoryPort,
    @Inject(ID_GENERATOR) private readonly idGen: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    dto: StartEncounterDto,
    providerId: string,
  ): Promise<{ id: string; patientId: string; status: string; createdAt: Date }> {
    const patient = await this.patientIdentityService.resolveOrCreate({
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
    });

    const templateRef = dto.templateId ? new TemplateId(dto.templateId) : undefined;

    const encounter = Encounter.start(
      new EncounterId(this.idGen.uuid()),
      new PatientId(patient.id),
      new UserId(providerId),
      this.clock.now(),
      templateRef,
    );
    encounter.pullEvents();

    const saved = await this.repo.save(encounter);

    return {
      id: saved.id.value,
      patientId: saved.patientRef.value,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }
}
