import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../identity/user.entity';
import { StartEncounterDto } from '../application/dto/start-encounter.dto';
import { UpdateDraftDto } from '../application/dto/update-draft.dto';
import { StartEncounterUseCase } from '../application/start-encounter.use-case';
import { UpdateDraftUseCase } from '../application/update-draft.use-case';
import { EncounterRepository } from '../infrastructure/encounter.repository';
import { EncounterId } from '../../../shared-kernel';

@Controller('encounters')
export class EncounterController {
  constructor(
    private readonly startEncounter: StartEncounterUseCase,
    private readonly updateDraft: UpdateDraftUseCase,
    private readonly repo: EncounterRepository,
  ) {}

  @Post()
  @HttpCode(201)
  @Auth(UserRole.PROVIDER)
  async create(
    @Body() dto: StartEncounterDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.startEncounter.execute(dto, user.id);
  }

  @Get()
  @Auth(UserRole.PROVIDER)
  async findAll(@CurrentUser() user: UserEntity) {
    const encounters = await this.repo.findByProvider(user.id);
    return encounters.map((e) => ({
      id: e.id.value,
      patientId: e.patientRef.value,
      providerId: e.providerRef.value,
      status: e.status,
      transcript: e.transcript?.text ?? null,
      workingDraft: e.workingDraft ?? null,
      createdAt: e.createdAt,
    }));
  }

  @Get(':id')
  @Auth(UserRole.PROVIDER)
  async findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    const encounter = await this.repo.findByProviderAndId(
      user.id,
      new EncounterId(id),
    );
    if (!encounter) throw new NotFoundException('Encounter not found');
    return {
      id: encounter.id.value,
      patientId: encounter.patientRef.value,
      providerId: encounter.providerRef.value,
      status: encounter.status,
      transcript: encounter.transcript?.text ?? null,
      workingDraft: encounter.workingDraft ?? null,
      createdAt: encounter.createdAt,
    };
  }

  @Patch(':id/draft')
  @HttpCode(200)
  @Auth(UserRole.PROVIDER)
  async patchDraft(
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
    @CurrentUser() user: UserEntity,
  ) {
    await this.updateDraft.execute(id, dto, user.id);
    return { ok: true };
  }
}
