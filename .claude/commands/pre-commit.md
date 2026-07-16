---
description: Full pre-commit gate — lint + typecheck + tests across the monorepo
---
Run these checks in order. Stop and report on first failure.

**Step 1 — Lint**
```
pnpm --filter backend lint
pnpm --filter frontend lint
```
Flag any error (not just warning). Autofix style issues only — do not autofix logic warnings.

**Step 2 — Typecheck**
```
pnpm --filter @scribe/contracts typecheck
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
```
Zero errors required before proceeding.

**Step 3 — Unit tests**
```
pnpm --filter backend test
```
All tests must pass. Flag any skipped test that covers a critical path (guardrails, ownership checks,
append-only versioning).

**Step 4 — Build**
```
pnpm --filter @scribe/contracts build
pnpm --filter backend build
pnpm --filter frontend build
```
Confirm production builds are clean.

**Step 5 — Security spot-check**
- No `.env` or `*.key` file staged (`git diff --cached --name-only`).
- No hardcoded secret string in the diff (grep for `password`, `secret`, `apikey` in changed lines).

Report: overall PASS / FAIL and which step failed with the exact error output.
