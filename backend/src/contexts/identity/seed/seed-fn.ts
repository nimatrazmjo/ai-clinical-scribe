import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { UserEntity } from '../user.entity';
import { DEMO_USERS } from './seed-data';

export async function seedUsers(ds: DataSource): Promise<void> {
  for (const u of DEMO_USERS) {
    const passwordHash = await argon2.hash(u.password);
    await ds
      .createQueryBuilder()
      .insert()
      .into(UserEntity)
      .values({
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        passwordHash,
        isActive: true,
      })
      .orIgnore()
      .execute();
  }
}
