# AI Clinical Scribe — Monorepo

## What this is

Provider-facing AI clinical documentation platform for the Kyron Medical take-home challenge.
Transcript/freeform input → streamed SOAP note (Subjective/Objective/Assessment/Plan) with ICD-10
codes. Graded on: core scribe workflow correctness, streaming quality, database design, infra
rigor, UI quality, prioritization judgment, non-happy-path handling, and code-walkthrough quality.
Deadline: Saturday, July 18, 2026, 3PM EST.

## Repo layout (pnpm workspace)

```
├── backend/             NestJS API — tiered DDD (see backend/CLAUDE.md)
├── frontend/             React SPA — clinical-grade UI (see frontend/CLAUDE.md)
├── infra/                Terraform + deploy scripts — AWS (see infra/CLAUDE.md)
└── packages/
└── contracts/        Shared TypeScript types: SOAP schema, API DTOs, SSE event types
```

Each subfolder has its own CLAUDE.md with a specific persona and rule set — that's the file that
governs when you're working inside it. This root file is for cross-cutting rules and anything that
spans more than one project.

## Cross-cutting rules

- `packages/contracts` is the only source of truth for shapes shared across backend and frontend
  (SoapNote, Encounter DTOs, Template shape, SSE event union). Never hand-duplicate a type on
  either side — import it.
- A feature that touches more than one layer (e.g. note templates) changes in this order:
  contracts → backend → frontend. Update the type first, let both sides fail to compile, then fix
  forward — that's the safety net working as intended, not a problem to route around.
- No PHI-shaped data (real patient names, real clinical content) in commits, logs, or seed data —
  demo data only, clearly fictional.
- Secrets never live in this repo, in any subfolder, in any form — see infra/CLAUDE.md for where
  they actually live (AWS Secrets Manager).
- Every subfolder's own CLAUDE.md takes precedence over this one for persona and conventions
  inside that folder. This file fills the gaps between them, it doesn't override them.

## Architecture at a glance

Tiered DDD modular monolith, single NestJS deployable, hexagonal internals only where real
invariants live:

- Full hexagonal: `encounter` (Encounter + NoteVersion aggregates, append-only versioning),
  `scribe` (LLM orchestration, anti-corruption layer to the vendor, guardrails, tool-calling).
- Flat Nest convention: `identity`, `patient`, `template`, `coding`, `audit` — CRUD-shaped, no
  forced layering.
  Don't re-derive this from scratch if the reasoning isn't in front of you — ask before assuming it
  changed.

## Build sequence (source of truth for "what's next")

S0 monorepo scaffold → S1 infra thin-slice (deploy first, before features) → S2 auth → S3 patient
→ S4 encounter+draft → S5 scribe streaming (core) → S6 history injection → S7 save+versioning →
S8 audit → S9 edge case: expired session → S10 ICD-10 search → S11 templates+live propagation →
S12 admin dashboard → S13 pioneer: version diff view → S14 harden + walkthrough script.
Core loop (S0–S9) should be demoable by end of day 1. Everything after is a differentiator — cut
from the bottom of this list if time runs short, never from the top.

## Definition of done (per rubric)

Before calling anything finished, it should survive: a cold clone + documented setup steps; a page
refresh mid-encounter with no lost draft; a save attempt on an expired token with no data loss; a
transcript with no clinical content producing a graceful message, not a fabricated note; and a live
walkthrough where every architectural choice above has a one-sentence justification ready.
