import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../identity/user.entity';
import { DomainException } from '../../shared-kernel';
import { TemplateRepository } from './template.repository';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('templates')
export class TemplateController {
  constructor(private readonly repo: TemplateRepository) {}

  @Post()
  @HttpCode(201)
  @Auth(UserRole.ADMIN)
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: UserEntity) {
    return this.repo.save({
      name: dto.name,
      encounterType: dto.encounterType ?? 'general',
      promptBody: dto.promptBody,
      isActive: false,
      createdBy: user.id,
    });
  }

  @Get()
  @Auth(UserRole.PROVIDER, UserRole.ADMIN)
  async findAll(@CurrentUser() user: UserEntity) {
    const all = await this.repo.findAll();
    if (user.role === UserRole.ADMIN) return all;
    return all.filter((t) => t.isActive);
  }

  @Get(':id')
  @Auth(UserRole.PROVIDER, UserRole.ADMIN)
  async findOne(@Param('id') id: string) {
    const tmpl = await this.repo.findById(id);
    if (!tmpl) throw new NotFoundException('Template not found');
    return tmpl;
  }

  @Put(':id')
  @Auth(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Template not found');
    return this.repo.save({ ...existing, ...dto });
  }

  @Delete(':id')
  @HttpCode(204)
  @Auth(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Template not found');
    await this.repo.softDelete(id);
  }
}
