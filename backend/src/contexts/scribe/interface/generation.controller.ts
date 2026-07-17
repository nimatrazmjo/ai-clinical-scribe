import { Controller, Inject, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../identity/user.entity';
import { EncounterRepository } from '../../encounter/infrastructure/encounter.repository';
import { EncounterId } from '../../../shared-kernel';
import { EncounterStatus } from '../../encounter/domain/value-objects/encounter-status';
import { LLM_PROVIDER } from '../domain/ports/llm-provider.port';
import type { LlmProvider } from '../domain/ports/llm-provider.port';
import { EmptyContentGuardrail } from '../domain/guardrails/empty-content.guardrail';
import { PromptAssembler } from '../domain/prompt-assembler';
import type { GenerationTool } from '../domain/ports/generation-tool.port';

@Controller('encounters')
export class GenerationController {
  constructor(
    private readonly encounterRepo: EncounterRepository,
    private readonly guardrail: EmptyContentGuardrail,
    private readonly promptAssembler: PromptAssembler,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  @Post(':id/generate')
  @Auth(UserRole.PROVIDER)
  async generate(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Req() _req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const encounter = await this.encounterRepo.findByProviderAndId(
        user.id,
        new EncounterId(id),
      );
      if (!encounter) {
        sendEvent({ type: 'error', message: 'Encounter not found' });
        res.end();
        return;
      }
      if (encounter.status !== EncounterStatus.DRAFT) {
        sendEvent({ type: 'error', message: 'Encounter is already finalized' });
        res.end();
        return;
      }

      const transcript = encounter.transcript?.text ?? '';
      const verdict = this.guardrail.check(transcript);
      if (!verdict.allowed) {
        sendEvent({ type: 'refused', reason: verdict.reason });
        res.end();
        return;
      }

      const ctx = this.promptAssembler.assemble({
        transcript,
        templateBody: null,
      });

      const tools: GenerationTool[] = [];

      for await (const event of this.llm.stream(ctx, tools)) {
        sendEvent(event);
        if (event.type === 'error' || event.type === 'done') break;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error';
      sendEvent({ type: 'error', message });
    } finally {
      res.end();
    }
  }
}
