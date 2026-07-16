---
description: Add a new tool the Scribe LLM can call during generation
argument-hint: <ToolName>
---
Implement `$1` in `src/contexts/scribe/infrastructure/tools/`, satisfying the `GenerationTool`
port (`name`, `schema`, `execute(args, ctx)`). Register it in the tool registry used by
`GenerateNote`. If it needs data from another context, call that context's `application` facade —
never its repository directly. Add a unit test with a mocked context.
