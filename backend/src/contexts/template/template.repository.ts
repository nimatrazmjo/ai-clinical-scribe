import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { TemplateOrmEntity } from './template.orm-entity';

@Injectable()
export class TemplateRepository {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async findActive(encounterType = 'general'): Promise<TemplateOrmEntity | null> {
    return this.ds.getRepository(TemplateOrmEntity).findOne({
      where: { isActive: true, encounterType },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<TemplateOrmEntity | null> {
    return this.ds.getRepository(TemplateOrmEntity).findOneBy({ id });
  }

  async findAll(): Promise<TemplateOrmEntity[]> {
    return this.ds.getRepository(TemplateOrmEntity).find({ order: { createdAt: 'DESC' } });
  }

  async save(template: Partial<TemplateOrmEntity>): Promise<TemplateOrmEntity> {
    return this.ds.getRepository(TemplateOrmEntity).save(template);
  }

  async softDelete(id: string): Promise<void> {
    await this.ds.getRepository(TemplateOrmEntity).update({ id }, { isActive: false });
  }
}
