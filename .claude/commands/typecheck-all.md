---
description: Typecheck every package in dependency order and surface all errors
---
Run typechecks in order — do not skip later stages even if an earlier one fails:

1. `pnpm --filter @scribe/contracts typecheck`
2. `pnpm --filter backend typecheck` (runs `tsc --noEmit`)
3. `pnpm --filter frontend typecheck` (runs `tsc -b`)

For every error found across all three:
- Show the package name, file path, and line number.
- Explain the root cause (structural mismatch, missing import from contracts, stale type, etc.).
- Propose the minimal fix. Never suggest `any` or `@ts-ignore` without justification.

After reviewing errors, check:
- Are any types duplicated between `packages/contracts` and either `backend/` or `frontend/`?
  If so, flag them — the contracts package is the single source of truth.
- Are all SSE event types, SOAP types, and DTO shapes imported from `@scribe/contracts`?
