import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EncounterModule } from '../encounter/encounter.module';
import { AuthModule } from '../auth/auth.module';
import { PromptAssembler } from './domain/prompt-assembler';
import { EmptyContentGuardrail } from './domain/guardrails/empty-content.guardrail';
import { GenerateNoteUseCase } from './application/generate-note.use-case';
import { GetPatientHistoryTool } from './domain/tools/get-patient-history.tool';
import { FakeLlmProvider } from './test-doubles/fake-llm-provider';
import { LLM_PROVIDER } from './domain/ports/llm-provider.port';
import { GenerationController } from './interface/generation.controller';

@Module({
  imports: [DatabaseModule, EncounterModule, AuthModule],
  providers: [
    PromptAssembler,
    EmptyContentGuardrail,
    GenerateNoteUseCase,
    GetPatientHistoryTool,
    { provide: LLM_PROVIDER, useValue: new FakeLlmProvider('clean-soap') },
  ],
  controllers: [GenerationController],
  exports: [GenerateNoteUseCase, GetPatientHistoryTool],
})
export class ScribeModule {}
