import { DataSource } from 'typeorm';
import { Argon2PasswordHasher } from '../argon2-password-hasher';
import { UserEntity } from '../user.entity';
import { DEMO_USERS } from './seed-data';

export async function seedUsers(ds: DataSource): Promise<void> {
  const hasher = new Argon2PasswordHasher();
  for (const u of DEMO_USERS) {
    const passwordHash = await hasher.hash(u.password);
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
