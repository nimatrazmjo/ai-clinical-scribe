---
description: Scaffold a new feature folder
argument-hint: <feature-name>
---
Create `src/features/$1/` with `api/`, `hooks/`, `components/` subfolders and an `index.ts` barrel
export. `api/` holds React Query hooks calling the backend, typed from `packages/contracts`.
`components/` are presentational plus one container. No business logic inside JSX — extract to a
hook.
