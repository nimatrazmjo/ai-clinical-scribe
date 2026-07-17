import { Controller, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../../identity/user.entity';
import { EncounterRepository } from '../../encounter/infrastructure/encounter.repository';
import { TemplateRepository } from '../../template/template.repository';
import { EncounterId } from '../../../shared-kernel';
import { EncounterStatus } from '../../encounter/domain/value-objects/encounter-status';
import { LLM_PROVIDER } from '../domain/ports/llm-provider.port';
import type { LlmProvider } from '../domain/ports/llm-provider.port';
import { EmptyContentGuardrail } from '../domain/guardrails/empty-content.guardrail';
import { PromptAssembler } from '../domain/prompt-assembler';
import { GetPatientHistoryTool } from '../domain/tools/get-patient-history.tool';
import type { GenerationTool } from '../domain/ports/generation-tool.port';

@Controller('encounters')
export class GenerationController {
  constructor(
    private readonly encounterRepo: EncounterRepository,
    private readonly templateRepo: TemplateRepository,
    private readonly guardrail: EmptyContentGuardrail,
    private readonly promptAssembler: PromptAssembler,
    private readonly historyTool: GetPatientHistoryTool,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  @Post(':id/generate')
  @Auth(UserRole.PROVIDER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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

    const abort = new AbortController();
    res.on('close', () => abort.abort());

    const sendEvent = (data: Record<string, unknown>) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
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

      // FR-TMPL-03: live-read active template on every generation call
      const activeTemplate = await this.templateRepo.findActive();

      const ctx = this.promptAssembler.assemble({
        transcript,
        templateBody: activeTemplate?.promptBody ?? null,
      });

      // FR-HIST-02: pass history tool so model can fetch prior encounters
      const tools: GenerationTool[] = [this.historyTool];

      for await (const event of this.llm.stream(ctx, tools, abort.signal)) {
        if (abort.signal.aborted) break;
        sendEvent(event);
        if (event.type === 'error' || event.type === 'done') break;
      }
    } catch (err: unknown) {
      if (!abort.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Internal error';
        sendEvent({ type: 'error', message });
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }
}
