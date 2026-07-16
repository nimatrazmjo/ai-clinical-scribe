---
description: Full cross-layer code review against every CLAUDE.md rule set
---
Review `git diff` (or `git diff main...HEAD` if on a feature branch) against all four CLAUDE.md
rule sets in one pass. Report every finding as: **layer | rule | file:line | PASS/FAIL | note**.

## Backend — DDD architecture (backend/CLAUDE.md)
1. Full-hexagonal contexts (encounter, scribe): no NestJS/TypeORM type in `domain/`. Check imports.
2. Cross-context rule: no context imports another context's `domain/` or `infrastructure/` directly.
3. `note_versions` append-only: zero UPDATE/DELETE in any repository touching that table.
4. Single pooled DataSource: no per-request `new DataSource()` or raw `pg.Client()`.
5. Secrets via `AwsSecretsLoader` only. No `process.env.DB_PASSWORD` inline.
6. Every protected route: `JwtAuthGuard` + ownership filter in the query.

## Backend — security (backend/CLAUDE.md)
7. DTOs validated with `class-validator`. Domain layer receives typed objects, not raw requests.
8. Passwords hashed with argon2/bcrypt. No plaintext comparison.
9. No PHI (note content, transcript text, patient name) in any log statement.
10. CORS origin is an explicit list, not `*`.

## Frontend — architecture (frontend/CLAUDE.md)
11. Streaming uses `fetch()` + `ReadableStream`. No `EventSource` anywhere.
12. Every stream has an `AbortController` wired on unmount/patient-switch.
13. Server state via React Query. Draft text in local component/hook state — not in the query cache.
14. API types come from `@scribe/contracts`. No hand-rolled duplicates.
15. No prop-drilling past two levels. Context or query hook instead.

## Frontend — design language (frontend/CLAUDE.md)
16. Every async action has a visible state: idle / streaming / saving / error.
17. No decorative gradients, animations for delight, or consumer-app color usage.
18. Accessibility: label association, keyboard operability, live-region for stream completion.

## Infra (infra/CLAUDE.md)
19. No `0.0.0.0/0` ingress on any port other than 443.
20. RDS security group: no public rule; ingress only from the app security group on 5432.
21. IAM role scoped to exactly what the app needs — no `AdministratorAccess`.
22. Every resource tagged `project=ai-clinical-scribe`.

## Contracts (root CLAUDE.md)
23. Shared types changed in contracts first, then backend, then frontend. Not the reverse.
24. No type in `backend/` or `frontend/` that duplicates a type in `packages/contracts`.
