import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { EncounterModule } from '../encounter/encounter.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [IdentityModule, EncounterModule, AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
