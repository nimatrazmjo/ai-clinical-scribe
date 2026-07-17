import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { UserEntity, UserRole } from './user.entity';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.ds.getRepository(UserEntity).findOneBy({ email });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.ds.getRepository(UserEntity).findOneBy({ id });
  }

  async findByRole(role: UserRole): Promise<UserEntity[]> {
    return this.ds.getRepository(UserEntity).findBy({ role });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.ds.getRepository(UserEntity).update({ id }, { isActive });
  }

  async save(user: UserEntity): Promise<UserEntity> {
    try {
      return await this.ds.getRepository(UserEntity).save(user);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const pg = err as QueryFailedError & { code?: string };
        if (pg.code === '23505') {
          throw new ConflictException(`Email already exists: ${user.email}`);
        }
      }
      throw err;
    }
  }
}
