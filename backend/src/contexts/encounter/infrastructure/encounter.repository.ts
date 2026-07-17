import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { EncounterId } from '../../../shared-kernel';
import { Encounter } from '../domain/encounter.aggregate';
import type { EncounterRepositoryPort } from '../domain/ports/encounter.repository.port';
import { EncounterOrmEntity, type SoapNoteJson } from './encounter.orm-entity';
import { EncounterMapper } from './encounter.mapper';

@Injectable()
export class EncounterRepository implements EncounterRepositoryPort {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async findById(id: EncounterId): Promise<Encounter | null> {
    const orm = await this.ds
      .getRepository(EncounterOrmEntity)
      .findOneBy({ id: id.value });
    return orm ? EncounterMapper.toDomain(orm) : null;
  }

  async findByProvider(providerRef: string): Promise<Encounter[]> {
    const rows = await this.ds
      .getRepository(EncounterOrmEntity)
      .findBy({ providerId: providerRef });
    return rows.map(EncounterMapper.toDomain);
  }

  async save(encounter: Encounter): Promise<Encounter> {
    const data = EncounterMapper.toOrm(encounter);
    const saved = await this.ds
      .getRepository(EncounterOrmEntity)
      .save(data);
    return EncounterMapper.toDomain(saved);
  }

  async findByProviderAndId(
    providerId: string,
    id: EncounterId,
  ): Promise<Encounter | null> {
    const orm = await this.ds
      .getRepository(EncounterOrmEntity)
      .findOneBy({ id: id.value, providerId });
    return orm ? EncounterMapper.toDomain(orm) : null;
  }

  async saveRawDraft(encounterId: string, draftJson: unknown): Promise<void> {
    await this.ds.getRepository(EncounterOrmEntity).update(
      { id: encounterId },
      { workingDraftJson: draftJson as SoapNoteJson },
    );
  }

  async saveTranscript(encounterId: string, text: string): Promise<void> {
    await this.ds.getRepository(EncounterOrmEntity).update(
      { id: encounterId },
      { currentTranscript: text },
    );
  }

  async findByFilter(filter: {
    providerId?: string;
    from?: Date;
    to?: Date;
  }): Promise<Encounter[]> {
    const qb = this.ds
      .getRepository(EncounterOrmEntity)
      .createQueryBuilder('e');
    if (filter.providerId) {
      qb.andWhere('e.providerId = :pid', { pid: filter.providerId });
    }
    if (filter.from) {
      qb.andWhere('e.createdAt >= :from', { from: filter.from });
    }
    if (filter.to) {
      qb.andWhere('e.createdAt < :to', { to: filter.to });
    }
    qb.orderBy('e.createdAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map(EncounterMapper.toDomain);
  }
}
