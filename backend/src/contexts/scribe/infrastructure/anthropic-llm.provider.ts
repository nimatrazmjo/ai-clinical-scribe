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

export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *stream(ctx: LlmContext, tools: GenerationTool[] = []): AsyncIterable<LlmEvent> {
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
      });

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
        for (const tb of toolUseBlocks) {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tb.inputJson) as Record<string, unknown>; } catch { /* ignore */ }
          assistantContent.push({ type: 'tool_use', id: tb.id, name: tb.name, input: parsed });
        }
        messages.push({ role: 'assistant', content: assistantContent });

        // Execute tools and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const tb of toolUseBlocks) {
          const tool = tools.find((t) => t.name === tb.name);
          let result: unknown = null;
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tb.inputJson) as Record<string, unknown>; } catch { /* ignore */ }
          if (tool) {
            result = await tool.execute(parsed);
          }
          yield { type: 'tool-call', toolName: tb.name, args: parsed };
          yield { type: 'tool-result', toolName: tb.name, result };
          toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: JSON.stringify(result) });
        }
        messages.push({ role: 'user', content: toolResults });
        // Reset section parser state for the continuation response
        sectionBuffer = '';
        currentSection = null;
      } else {
        continueLoop = false;
        yield { type: 'done', rawContent: fullText };
      }
    }
  }
}
