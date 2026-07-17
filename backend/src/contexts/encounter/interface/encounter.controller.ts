import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../identity/user.entity';
import { StartEncounterDto } from '../application/dto/start-encounter.dto';
import { UpdateDraftDto } from '../application/dto/update-draft.dto';
import { SetTranscriptDto } from '../application/dto/set-transcript.dto';
import { SaveNoteDto } from '../application/dto/save-note.dto';
import { StartEncounterUseCase } from '../application/start-encounter.use-case';
import { UpdateDraftUseCase } from '../application/update-draft.use-case';
import { SaveNoteVersionUseCase } from '../application/save-note-version.use-case';
import { EncounterRepository } from '../infrastructure/encounter.repository';
import { NoteVersionRepository } from '../infrastructure/note-version.repository';
import { EncounterId } from '../../../shared-kernel';
import { diffSoapNotes, SoapNoteSnapshot } from '../domain/diff-soap-notes';

function versionToResponse(v: {
  id: { value: string };
  encounterId: { value: string };
  versionNo: number;
  content: {
    subjective: string;
    objective: string;
    assessment: { text: string; icd10: Array<{ code: string; description: string }> };
    plan: string;
  };
  savedBy: { value: string };
  savedAt: Date;
}) {
  return {
    id: v.id.value,
    encounterId: v.encounterId.value,
    versionNo: v.versionNo,
    content: {
      subjective: v.content.subjective,
      objective: v.content.objective,
      assessment: {
        text: v.content.assessment.text,
        icd10: v.content.assessment.icd10.map((c) => ({
          code: c.code,
          description: c.description,
        })),
      },
      plan: v.content.plan,
    },
    savedBy: v.savedBy.value,
    savedAt: v.savedAt,
  };
}

@Controller('encounters')
export class EncounterController {
  constructor(
    private readonly startEncounter: StartEncounterUseCase,
    private readonly updateDraft: UpdateDraftUseCase,
    private readonly saveNoteVersion: SaveNoteVersionUseCase,
    private readonly repo: EncounterRepository,
    private readonly noteVersionRepo: NoteVersionRepository,
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

  @Patch(':id/transcript')
  @HttpCode(200)
  @Auth(UserRole.PROVIDER)
  async setTranscript(
    @Param('id') id: string,
    @Body() dto: SetTranscriptDto,
    @CurrentUser() user: UserEntity,
  ) {
    const encounter = await this.repo.findByProviderAndId(user.id, new EncounterId(id));
    if (!encounter) throw new NotFoundException('Encounter not found');
    await this.repo.saveTranscript(id, dto.text);
    return { ok: true };
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

  @Post(':id/notes')
  @HttpCode(201)
  @Auth(UserRole.PROVIDER)
  async saveNote(
    @Param('id') id: string,
    @Body() dto: SaveNoteDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.saveNoteVersion.execute(id, dto, user.id);
  }

  @Get(':id/versions')
  @Auth(UserRole.PROVIDER)
  async listVersions(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    const encounter = await this.repo.findByProviderAndId(
      user.id,
      new EncounterId(id),
    );
    if (!encounter) throw new NotFoundException('Encounter not found');
    const versions = await this.noteVersionRepo.listByEncounter(id);
    return versions.map(versionToResponse);
  }

  @Get(':id/versions/diff')
  @Auth(UserRole.PROVIDER)
  async diffVersions(
    @Param('id') id: string,
    @Query('from', ParseIntPipe) fromNo: number,
    @Query('to', ParseIntPipe) toNo: number,
    @CurrentUser() user: UserEntity,
  ) {
    const encounter = await this.repo.findByProviderAndId(user.id, new EncounterId(id));
    if (!encounter) throw new NotFoundException('Encounter not found');

    const [fromVersion, toVersion] = await Promise.all([
      this.noteVersionRepo.findByEncounterAndVersion(id, fromNo),
      this.noteVersionRepo.findByEncounterAndVersion(id, toNo),
    ]);

    if (!fromVersion) throw new NotFoundException(`Version ${fromNo} not found`);
    if (!toVersion) throw new NotFoundException(`Version ${toNo} not found`);

    const fromSnap: SoapNoteSnapshot = {
      subjective: fromVersion.content.subjective,
      objective: fromVersion.content.objective,
      assessment: {
        text: fromVersion.content.assessment.text,
        icd10: fromVersion.content.assessment.icd10.map((c) => ({
          code: c.code,
          description: c.description,
        })),
      },
      plan: fromVersion.content.plan,
    };

    const toSnap: SoapNoteSnapshot = {
      subjective: toVersion.content.subjective,
      objective: toVersion.content.objective,
      assessment: {
        text: toVersion.content.assessment.text,
        icd10: toVersion.content.assessment.icd10.map((c) => ({
          code: c.code,
          description: c.description,
        })),
      },
      plan: toVersion.content.plan,
    };

    return {
      encounterId: id,
      from: fromNo,
      to: toNo,
      diff: diffSoapNotes(fromSnap, toSnap),
    };
  }

  @Get(':id/versions/:n')
  @Auth(UserRole.PROVIDER)
  async getVersion(
    @Param('id') id: string,
    @Param('n', ParseIntPipe) n: number,
    @CurrentUser() user: UserEntity,
  ) {
    const encounter = await this.repo.findByProviderAndId(
      user.id,
      new EncounterId(id),
    );
    if (!encounter) throw new NotFoundException('Encounter not found');
    const version = await this.noteVersionRepo.findByEncounterAndVersion(id, n);
    if (!version) throw new NotFoundException('Version not found');
    return versionToResponse(version);
  }
}
