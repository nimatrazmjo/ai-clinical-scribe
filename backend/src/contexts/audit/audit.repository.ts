import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { AuditEntryOrmEntity } from './audit-entry.orm-entity';

export interface AuditRecord {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditRepository {
  private readonly logger = new Logger(AuditRepository.name);

  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async record(entry: AuditRecord): Promise<void> {
    try {
      await this.ds.getRepository(AuditEntryOrmEntity).save({
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata ?? {},
      });
    } catch (err) {
      // Audit failures must never break the main flow
      this.logger.error('Failed to write audit entry', err);
    }
  }
}
