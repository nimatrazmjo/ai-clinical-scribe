---
description: Build the entire monorepo in dependency order
---
Build in this exact order — stop and report on the first failure, do not continue past a broken layer:

1. `pnpm --filter @scribe/contracts build` — compile shared types first.
2. `pnpm --filter backend build` — NestJS must compile cleanly against the freshly built contracts.
3. `pnpm --filter frontend build` — React SPA must compile cleanly; check for any missing contract
   imports that were hand-rolled instead.

After all three succeed:
- Confirm `packages/contracts/dist/index.js` exists.
- Confirm `backend/dist/main.js` exists.
- Confirm `frontend/dist/index.html` exists.
- Run `pnpm --filter backend typecheck` and `pnpm --filter frontend typecheck` to catch any type
  errors that the build step skipped.

Report: total build time and sizes of `backend/dist` and `frontend/dist`.
