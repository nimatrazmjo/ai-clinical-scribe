import Anthropic from '@anthropic-ai/sdk';
import type { LlmContext, LlmEvent, LlmProvider, SectionKey } from '../domain/ports/llm-provider.port';
import type { GenerationTool } from '../domain/ports/generation-tool.port';
import { FORMAT_INSTRUCTION } from '../domain/format-instruction';

const SECTION_KEYS: SectionKey[] = ['subjective', 'objective', 'assessment', 'plan'];

type AnthropicTool = Anthropic.Tool;
type MessageParam = Anthropic.MessageParam;
type ContentBlockParam = Anthropic.ContentBlockParam;

function toAnthropicTool(tool: GenerationTool): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.schema as AnthropicTool['input_schema'],
  };
}

/**
 * Anti-corruption layer for vendor failures: turn a raw Anthropic SDK error
 * into a message a clinician can act on, never a status code or stack trace.
 * The raw error is logged server-side (CloudWatch) for ops; only the friendly
 * text reaches the provider's screen.
 */
function friendlyLlmError(err: unknown): string {
  const generic =
    'The note could not be generated because the AI service is temporarily unavailable. Please try again in a moment.';

  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    const detail = `${err.message ?? ''}`.toLowerCase();

    // Out of credits / billing — a clinician can't resolve this; point to the
    // administrator without exposing billing internals.
    if (status === 402 || detail.includes('credit balance') || detail.includes('billing')) {
      return 'The AI service is temporarily unavailable. Please contact your administrator, then try again.';
    }
    // Bad/expired API key or permissions — also an admin/config matter.
    if (status === 401 || status === 403) {
      return 'The AI service is temporarily unavailable due to a configuration issue. Please contact your administrator.';
    }
    // Too many requests.
    if (status === 429) {
      return 'The AI service is busy right now. Please wait a few seconds and try again.';
    }
    // Anthropic overloaded.
    if (status === 529) {
      return 'The AI service is temporarily overloaded. Please try again in a moment.';
    }
  }

  return generic;
}

export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *stream(ctx: LlmContext, tools: GenerationTool[] = [], signal?: AbortSignal): AsyncIterable<LlmEvent> {
    try {
      yield* this.streamInternal(ctx, tools, signal);
    } catch (err) {
      // Client hung up mid-stream — not an error worth surfacing.
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) return;
      // Log the real cause for ops (CloudWatch); show the clinician something
      // actionable instead of a raw status code or SDK stack trace.
      console.error('[AnthropicLlmProvider] generation failed:', err);
      yield { type: 'error', message: friendlyLlmError(err) };
    }
  }

  private async *streamInternal(ctx: LlmContext, tools: GenerationTool[] = [], signal?: AbortSignal): AsyncIterable<LlmEvent> {
    const systemPrompt = ctx.systemPrompt + FORMAT_INSTRUCTION;
    const messages: MessageParam[] = [{ role: 'user', content: ctx.userMessage }];
    const anthropicTools: AnthropicTool[] = tools.map(toAnthropicTool);

    // State machine for parsing section tags across chunks
    let sectionBuffer = '';
    let currentSection: SectionKey | null = null;

    function* parseChunk(chunk: string): Generator<LlmEvent> {
      sectionBuffer += chunk;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (currentSection === null) {
          // Search for the earliest open tag
          let earliest: { key: SectionKey; idx: number } | null = null;
          for (const key of SECTION_KEYS) {
            const idx = sectionBuffer.indexOf(`<${key}>`);
            if (idx !== -1 && (earliest === null || idx < earliest.idx)) {
              earliest = { key, idx };
            }
          }
          if (!earliest) break; // No open tag yet

          sectionBuffer = sectionBuffer.slice(earliest.idx + earliest.key.length + 2);
          currentSection = earliest.key;
        } else {
          const closeTag = `</${currentSection}>`;
          const closeIdx = sectionBuffer.indexOf(closeTag);

          if (closeIdx === -1) {
            // Tag not closed; yield safe prefix (leave potential partial close tag in buffer)
            const safe = sectionBuffer.length - (closeTag.length - 1);
            if (safe > 0) {
              const text = sectionBuffer.slice(0, safe);
              sectionBuffer = sectionBuffer.slice(safe);
              if (text) yield { type: 'section-delta', section: currentSection, text };
            }
            break;
          } else {
            const text = sectionBuffer.slice(0, closeIdx);
            const sec = currentSection;
            sectionBuffer = sectionBuffer.slice(closeIdx + closeTag.length);
            currentSection = null;
            if (text) yield { type: 'section-delta', section: sec, text };
          }
        }
      }
    }

    let continueLoop = true;
    while (continueLoop) {
      const rawStream = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
        stream: true,
      }, { signal });

      let fullText = '';
      const toolUseBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
      let currentToolBlock: { id: string; name: string; inputJson: string } | null = null;
      let stopReason: string | null = null;

      for await (const event of rawStream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolBlock = {
              id: event.content_block.id,
              name: event.content_block.name,
              inputJson: '',
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            yield* parseChunk(event.delta.text);
          } else if (event.delta.type === 'input_json_delta' && currentToolBlock) {
            currentToolBlock.inputJson += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolBlock) {
            toolUseBlocks.push(currentToolBlock);
            currentToolBlock = null;
          }
        } else if (event.type === 'message_delta') {
          stopReason = event.delta.stop_reason ?? null;
        }
      }

      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        // Build assistant message with text + tool_use blocks
        const assistantContent: ContentBlockParam[] = [];
        if (fullText) assistantContent.push({ type: 'text', text: fullText });

        // Parse each tool block's JSON once and reuse
        const parsedBlocks = toolUseBlocks.map((tb) => {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tb.inputJson) as Record<string, unknown>; } catch { /* ignore */ }
          return { ...tb, args };
        });

        for (const pb of parsedBlocks) {
          assistantContent.push({ type: 'tool_use', id: pb.id, name: pb.name, input: pb.args });
        }
        messages.push({ role: 'assistant', content: assistantContent });

        // Execute tools and stream events
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const pb of parsedBlocks) {
          const tool = tools.find((t) => t.name === pb.name);
          let result: unknown = null;
          if (tool) {
            if (typeof pb.args['patientId'] !== 'string') {
              result = { error: 'patientId must be a string' };
            } else {
              result = await tool.execute(pb.args);
            }
          }
          yield { type: 'tool-call', toolName: pb.name, args: pb.args };
          yield { type: 'tool-result', toolName: pb.name, result };
          toolResults.push({ type: 'tool_result', tool_use_id: pb.id, content: JSON.stringify(result) });
        }
        messages.push({ role: 'user', content: toolResults });
        sectionBuffer = '';
        currentSection = null;
      } else {
        continueLoop = false;
        // If the model returned text but produced no section tags, treat it as a refusal.
        const hasSections = SECTION_KEYS.some((k) => fullText.includes(`<${k}>`));
        if (!hasSections && fullText.trim()) {
          yield { type: 'error', message: `Model did not produce a SOAP note. Response: ${fullText.slice(0, 200)}` };
        } else {
          yield { type: 'done', rawContent: fullText };
        }
      }
    }
  }
}
