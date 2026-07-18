import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
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
    // providerId column is a uuid; a non-uuid value makes Postgres throw
    // "invalid input syntax for type uuid" (a 500). A malformed filter has no
    // matches by definition, so return empty rather than erroring.
    const providerFilter = providerId?.trim();
    if (providerFilter && !isUUID(providerFilter)) {
      return [];
    }

    // Ignore unparseable dates instead of passing an Invalid Date into the query.
    const parseDate = (v?: string): Date | undefined => {
      if (!v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    // The date inputs send YYYY-MM-DD (UTC midnight). The repo filters
    // createdAt < :to, so a bare "to" date would exclude everything on that
    // day; advance it by one day so the whole selected day is included.
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    const toExclusive = toDate
      ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    const encounters = await this.encounterRepo.findByFilter({
      providerId: providerFilter,
      from: fromDate,
      to: toExclusive,
    });
    const patientIds = [...new Set(encounters.map((e) => e.patientRef.value))];
    const providerIds = [
      ...new Set(encounters.map((e) => e.providerRef.value)),
    ];
    const [patientMap, providerMap] = await Promise.all([
      this.encounterRepo.findPatientsByIds(patientIds),
      this.userRepo.findByIds(providerIds),
    ]);

    return encounters.map((e) => {
      const p = patientMap.get(e.patientRef.value);
      const prov = providerMap.get(e.providerRef.value);
      return {
        id: e.id.value,
        status: e.status,
        patientFirstName: p?.firstName ?? '',
        patientLastName: p?.lastName ?? '',
        patientDateOfBirth: p?.dateOfBirth ?? '',
        transcript: e.transcript?.text ?? null,
        draft: null,
        draftRevision: 0,
        templateId: e.selectedTemplateRef?.value ?? null,
        providerId: e.providerRef.value,
        providerName: prov
          ? `${prov.firstName} ${prov.lastName}`
          : e.providerRef.value,
        providerEmail: prov?.email ?? '',
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
      };
    });
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

  @Get('test')
  @Auth(UserRole.ADMIN)
  async test() {
    return { ok: true };
  }

  @Get('test1')
  @Auth(UserRole.ADMIN)
  async test1() {
    return { ok: true };
  }
}
