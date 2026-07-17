import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TemplateRepository } from './template.repository';
import { TemplateController } from './template.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [TemplateRepository],
  controllers: [TemplateController],
  exports: [TemplateRepository],
})
export class TemplateModule {}
