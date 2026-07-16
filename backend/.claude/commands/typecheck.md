---
description: Run the TypeScript compiler and explain every error in context
---
Run `tsc --noEmit` from the backend root. For each error:
- Show the file path and line number.
- Quote the failing line.
- Explain *why* it fails (missing type, structural mismatch, broken import, etc.).
- Suggest the minimal fix that preserves the architecture — do not suggest `any` or `@ts-ignore`
  unless there is literally no typed alternative, and explain why in that case.

After all errors: confirm whether `packages/contracts` types are correctly imported (not hand-duplicated).
Flag any `noImplicitAny` gaps that hint at a missing type definition.
