import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { PASSWORD_HASHER } from './password-hasher.port';
import { UserRepository } from './user.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    UserRepository,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
  exports: [UserRepository, PASSWORD_HASHER],
})
export class IdentityModule {}
