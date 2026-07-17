import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserEntity, UserRole } from '../identity/user.entity';
import { UserRepository } from '../identity/user.repository';
import { EncounterRepository } from '../encounter/infrastructure/encounter.repository';
import { PASSWORD_HASHER } from '../identity/password-hasher.port';
import type { PasswordHasher } from '../identity/password-hasher.port';
import { CreateProviderDto } from './dto/create-provider.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly encounterRepo: EncounterRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  @Get('encounters')
  @Auth(UserRole.ADMIN)
  async listEncounters(
    @Query('providerId') providerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const encounters = await this.encounterRepo.findByFilter({
      providerId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return encounters.map((e) => ({
      id: e.id.value,
      patientId: e.patientRef.value,
      providerId: e.providerRef.value,
      status: e.status,
      createdAt: e.createdAt,
    }));
  }

  @Post('providers')
  @HttpCode(201)
  @Auth(UserRole.ADMIN)
  async createProvider(@Body() dto: CreateProviderDto) {
    const passwordHash = await this.hasher.hash(dto.password);
    const user = new UserEntity();
    user.email = dto.email;
    user.firstName = dto.firstName;
    user.lastName = dto.lastName;
    user.role = UserRole.PROVIDER;
    user.passwordHash = passwordHash;
    user.isActive = true;
    const saved = await this.userRepo.save(user);
    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      role: saved.role,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }

  @Get('providers')
  @Auth(UserRole.ADMIN)
  async listProviders() {
    const providers = await this.userRepo.findByRole(UserRole.PROVIDER);
    return providers.map((p) => ({
      id: p.id,
      email: p.email,
      firstName: p.firstName,
      lastName: p.lastName,
      isActive: p.isActive,
      createdAt: p.createdAt,
    }));
  }

  @Patch('providers/:id/deactivate')
  @HttpCode(200)
  @Auth(UserRole.ADMIN)
  async deactivateProvider(@Param('id') id: string) {
    const user = await this.userRepo.findById(id);
    if (!user || user.role !== UserRole.PROVIDER) {
      throw new NotFoundException('Provider not found');
    }
    await this.userRepo.setActive(id, false);
    return { ok: true };
  }
}
