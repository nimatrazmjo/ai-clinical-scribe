import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { UserEntity } from './user.entity';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.ds.getRepository(UserEntity).findOneBy({ email });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.ds.getRepository(UserEntity).findOneBy({ id });
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
