export interface GenerationTool {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<unknown>;
}
