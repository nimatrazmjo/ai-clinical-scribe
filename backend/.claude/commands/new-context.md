---
description: Scaffold a new bounded context module (asks tier: full hexagonal or flat)
argument-hint: <context-name> <full|flat>
---
Scaffold a new bounded context named `$1` at `src/contexts/$1`.

If tier is `full`: create `domain/`, `application/`, `infrastructure/`, `interface/` subfolders.
Domain layer has zero NestJS/TypeORM imports. Define ports as interfaces in `domain/ports`,
implement adapters in `infrastructure/`. Application layer holds use-case classes only. Interface
layer holds the controller and any SSE/WS gateway.

If tier is `flat`: create a single `$1.module.ts`, `$1.service.ts`, `$1.controller.ts`, and
`$1.entity.ts` (TypeORM-decorated) — no forced layering.

Register the new module in `app.module.ts`. This context must never import another context's
`domain/` or `infrastructure/` directly — only their `application` facade or emitted domain events.
