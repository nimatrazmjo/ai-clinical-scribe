import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EncounterModule } from '../encounter/encounter.module';
import { AuthModule } from '../auth/auth.module';
import { TemplateModule } from '../template/template.module';
import { PromptAssembler } from './domain/prompt-assembler';
import { EmptyContentGuardrail } from './domain/guardrails/empty-content.guardrail';
import { GenerateNoteUseCase } from './application/generate-note.use-case';
import { GetPatientHistoryTool } from './domain/tools/get-patient-history.tool';
import { FakeLlmProvider } from './test-doubles/fake-llm-provider';
import { AnthropicLlmProvider } from './infrastructure/anthropic-llm.provider';
import { LLM_PROVIDER } from './domain/ports/llm-provider.port';
import { GenerationController } from './interface/generation.controller';

function buildLlmProvider() {
  if (process.env['USE_FAKE_LLM'] === 'true') {
    return new FakeLlmProvider('clean-soap');
  }
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required. Set USE_FAKE_LLM=true to use the fake provider.');
  }
  return new AnthropicLlmProvider(apiKey);
}

@Module({
  imports: [DatabaseModule, EncounterModule, AuthModule, TemplateModule],
  providers: [
    PromptAssembler,
    EmptyContentGuardrail,
    GenerateNoteUseCase,
    GetPatientHistoryTool,
    { provide: LLM_PROVIDER, useValue: buildLlmProvider() },
  ],
  controllers: [GenerationController],
  exports: [GenerateNoteUseCase, GetPatientHistoryTool],
})
export class ScribeModule {}
