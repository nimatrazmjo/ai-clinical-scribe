# AI Clinical Scribe

A provider-facing clinical documentation platform that turns a raw visit transcript (or freeform notes) into a structured, streamed SOAP note with suggested ICD-10 codes.

**Live demo:** https://test.nimat.dev

> The demo domain is temporary and will be torn down roughly one week after submission. HTTPS is a Terraform toggle (`domain_name` + `hosted_zone_name`), so the same stack can be re-pointed to any domain by changing two variables and re-applying.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [AI / LLM design](#ai--llm-design)
5. [Data model](#data-model)
6. [How each evaluation criterion is met](#how-each-evaluation-criterion-is-met)
7. [Non-happy-path handling](#non-happy-path-handling)
8. [Local development](#local-development)
9. [Deployment](#deployment)
10. [Security posture](#security-posture)
11. [Repository structure](#repository-structure)
12. [Known limitations and roadmap](#known-limitations-and-roadmap)

---

## What it does

A provider signs in, opens or creates an encounter for a patient, and pastes or types the visit content. The note generates live: each SOAP section (Subjective, Objective, Assessment, Plan) renders token-by-token as the model produces it, and the Assessment resolves suggested ICD-10 codes as its block closes. During generation the model can pull the patient's prior encounters through a server-side tool call, so a returning patient's note is informed by history the provider never had to paste in. Every save writes a new immutable note version, so the full edit history of a clinical document is preserved and attributable.

## Tech stack

| Layer | Technology | Why |
| --- | --- | --- |
| Monorepo | pnpm workspace | One install, one dependency graph; shared types compile once and both apps consume them. |
| Shared contracts | TypeScript (`packages/contracts`) | Single source of truth for the SOAP schema, DTOs, and the SSE event union — a shape change breaks both sides at compile time, not in production. |
| Backend | NestJS + TypeScript | Tiered DDD modular monolith with dependency injection; hexagonal boundaries where invariants live, flat modules where they don't. |
| Frontend | React + TypeScript + Vite + Tailwind | Fast dev loop and a clinical-grade UI where every state (streaming, error, refused, expired) is a first-class render path. |
| Persistence | PostgreSQL on AWS RDS via TypeORM | Relational data with real referential integrity; TypeORM's built-in pool keeps connection count bounded under load. |
| Semantic search | pgvector | ICD-10 lookup by meaning, not just string match, without adding a second datastore. |
| IDs | pgcrypto | Server-generated UUIDs in the database, not application-guessed. |
| AI | Anthropic Claude (`claude-sonnet-4-6`) | Low streaming latency, native tool-calling, and strong clinical reasoning at lower cost/latency than Opus. |
| Auth | JWT access tokens + argon2 | Stateless request auth; memory-hard password hashing resistant to GPU cracking. |
| Infra | AWS ECS on EC2, ALB, RDS, Secrets Manager, Terraform, GitHub Actions (OIDC) | Reproducible infrastructure as code; no static cloud credentials anywhere in the pipeline. |

## Architecture

The backend is a **tiered DDD modular monolith**: a single NestJS deployable, internally partitioned into bounded contexts. It is deliberately *not* uniformly hexagonal — layering is applied only where it earns its cost.

- **Hexagonal contexts** — `encounter` and `scribe`. These hold the real invariants (append-only note versioning; LLM orchestration with an anti-corruption layer to the vendor), so they get the full application / domain / infrastructure / interface split with ports and adapters. *Why:* the domain rules here must be testable and vendor-swappable in isolation.
- **Flat Nest contexts** — `identity`, `patient`, `template`, `coding`, `audit` (and the CRUD-shaped `admin` / `auth` surfaces). These are CRUD-shaped with no deep invariants, so they use plain Nest module/service/repository convention. *Why:* forcing hexagonal layering on a lookup table is ceremony without benefit.

**Contracts as the single source of truth.** `packages/contracts` defines the SOAP note schema, request/response DTOs, and the SSE event union. Neither app hand-duplicates a shared shape; both import it. A cross-layer change goes contracts → backend → frontend, and the compiler enforces the order.

**Request path:**

```
browser → ALB (HTTPS, ACM cert) → nginx (reverse proxy) → NestJS API → RDS (private, in-VPC)
```

The ALB terminates HTTPS and redirects 80→443. nginx serves the built SPA and proxies `/api` to the NestJS process over loopback — the API is never exposed to the internet directly. RDS lives in private subnets inside the VPC and is not publicly accessible; only the application security group can reach it.

## AI / LLM design

**Model.** `claude-sonnet-4-6`, wired through the Anthropic provider in the `scribe` context (`backend/src/contexts/scribe/infrastructure/anthropic-llm.provider.ts`). Chosen for low streaming latency (the note renders token-by-token rather than spinner-then-dump), native tool-calling (used for server-side history injection), and strong clinical reasoning at materially lower cost and latency than Opus.

**Streaming.** The server emits Server-Sent Events. A section-tag state machine parses `<subjective>`, `<objective>`, `<assessment>`, and `<plan>` tags as they arrive across chunk boundaries, so each section begins rendering the moment its tag opens. The Assessment section streams as JSON, so the suggested ICD-10 codes resolve and render as that block closes rather than waiting for the whole note.

**History injection (tool-based).** Prior encounters are *not* stuffed into the frontend prompt. Instead the model invokes a backend `get-patient-history` tool *during* generation; the server looks the patient up by (first name, last name, DOB), fetches prior encounters, and returns them as a tool result. Generation demonstrably differs for a returning patient versus a first-time patient, and the history never round-trips through the browser.

**Live template propagation.** The active note template is re-read from the database on every generation. An admin editing a template takes effect on the provider's *next* generation — no redeploy, no page refresh.

**Guardrails and anti-corruption.** A pre-LLM `EmptyContentGuardrail` rejects empty, too-short, non-textual, or non-clinical input before any model call. The Anthropic provider is an anti-corruption layer: it maps vendor failure modes (out-of-credit, rate-limit, auth, overload) to clinician-friendly messages surfaced over SSE, while logging the raw cause server-side for the operator.

## Data model

Normalized PostgreSQL schema. In prose: a **user/provider** authors many **encounters**; each encounter belongs to one **patient** and owns an append-only chain of **note_versions**. **Templates** shape generation; **icd10_codes** (with vector embeddings) back semantic code search; **audit_log** records security- and clinically-relevant actions.

| Table | Holds | Key relationships |
| --- | --- | --- |
| `users` (providers) | Provider and admin accounts, argon2 password hash, role | Authors `encounters`; referenced as author on `note_versions`. |
| `patients` | Demo patient identity (name, DOB) | Referenced by `encounters`; the (first name, last name, DOB) key the history tool resolves against. |
| `encounters` | One clinical visit / documentation session | FK → `users` (author), FK → `patients`; owns many `note_versions`. |
| `note_versions` | One immutable SOAP note revision (content + author + timestamp) | FK → `encounters`; **append-only**. |
| `templates` | Note templates re-read live at generation time | Referenced during generation; editable by admins. |
| `audit_log` | Append-only record of notable actions | References the acting `user`. |
| `icd10_codes` | ICD-10 catalogue with pgvector embeddings | Backs semantic code search; suggested codes reference these. |

**Why `note_versions` is append-only.** A clinical document is a legal and medical record — every edit must be attributable and nothing can be silently overwritten or deleted. Each save writes a *new* immutable version stamped with author and timestamp; prior versions are never mutated or removed. This gives a complete, tamper-evident edit history for free and makes a diff view a pure read over existing rows rather than a reconstruction.

## How each evaluation criterion is met

| Criterion | How |
| --- | --- |
| **Core scribe workflow correctness** | Sign in → select patient → paste transcript → streamed SOAP note with ICD-10 codes → save as an immutable version. The end-to-end provider loop works and is demoable with the seeded credentials below. |
| **Streaming quality** | SSE + a section-tag state machine render each SOAP section token-by-token as it is produced; the Assessment streams as JSON so codes resolve as the block closes. No spinner-then-dump. |
| **Database design** | Normalized schema with real FKs, append-only `note_versions` for an attributable edit history, and pgvector for semantic ICD-10 search — one datastore, no denormalized note blobs. |
| **Infrastructure rigor** | All secrets in AWS Secrets Manager (none in code or Terraform state); RDS private in-VPC and not publicly reachable; TypeORM connection pooling; nginx reverse proxy so the API is never directly exposed; HTTPS via ACM cert on the ALB with 80→443 redirect; everything is Terraform IaC. |
| **UI quality** | Clinical-grade React UI where streaming, error, refused-input, and expired-session are each first-class render paths, not afterthoughts. |
| **Prioritization judgment** | Infrastructure thin-slice deployed before features; the core provider loop built before differentiators (ICD-10 search, live templates, admin dashboard, version diff); hexagonal layering spent only where invariants live. |
| **Non-happy-path handling** | A pre-LLM guardrail refuses meaningless input instead of fabricating a note; an expired-session save returns a typed 401, the draft is rescued, and idempotent replay yields exactly one version (see below). |
| **Code-walkthrough readiness** | Bounded contexts map one-to-one to rubric concerns; `packages/contracts` is the single source of truth; each architectural choice has a one-sentence justification (this README pairs every "what" with a "why"). |

## Non-happy-path handling

**1. Empty or non-clinical input — no fabrication.** Before any model call, `EmptyContentGuardrail` rejects input that is empty, too short, non-textual, or not clinically meaningful. The server returns a graceful "refused" message over SSE. The model is never invoked and no note is fabricated — the UI shows the refusal as an explicit state, not an error.

**2. Save on an expired session — no data loss.** Drafts autosave to RDS continuously as the note is edited. If a save fires with an expired JWT, the API returns **401 with a specific `TOKEN_EXPIRED` code** (not a generic 401). The frontend catches it, rescues the in-progress note in memory, and prompts re-authentication. Saves are idempotent via a `draftRevision` key, so re-auth followed by replaying the pending save creates **exactly one** version — no duplicate, no lost work.

## Local development

**Prerequisites:** Node 20+, pnpm, Docker (for Postgres + the app containers), and an `ANTHROPIC_API_KEY` (or `USE_FAKE_LLM=true` to run the deterministic fake provider with no key).

```bash
# 1. Install the whole workspace
pnpm install

# 2. Bring up Postgres, the API, and the web tier
docker compose up -d

# 3. Seed demo data (providers, admin, patients, templates, ICD-10)
pnpm --filter backend seed
```

The SPA is served through nginx (same reverse-proxy shape as production); the API is reachable at `/api`. The database schema is already migrated on the deployed environment.

**Demo credentials**

| Role | Email | Password |
| --- | --- | --- |
| Provider | `dr.alice@demo.clinic` | `DemoPass1!` |
| Provider | `dr.bob@demo.clinic` | `DemoPass2!` |
| Provider | `dr.carol@demo.clinic` | `DemoPass3!` |
| Admin | `admin@demo.clinic` | `AdminPass1!` |

> Seed data is clearly fictional. No real patient names or clinical content exist anywhere in the repo, logs, or seeds.

## Deployment

Terraform provisions the AWS shell — VPC and subnets, ALB with the ACM cert and 80→443 redirect, ECS cluster on EC2, the RDS instance in private subnets, Secrets Manager entries, and the GitHub OIDC deploy role. Secrets are seeded **out of band** into Secrets Manager; they never appear in code or Terraform state.

CI/CD runs in GitHub Actions and authenticates to AWS via **OIDC — no static access keys**. The pipeline builds the web and api images, pushes them to ECR, and triggers a rolling ECS deploy. Database migrations run as a **one-off ECS task** against the same image, decoupled from the long-running service so a migration never blocks or is coupled to a rollout.

Both containers (nginx web + NestJS api) currently run in a **single ECS task** on one EC2 instance — see [Known limitations](#known-limitations-and-roadmap).

## Security posture

- **Auth:** stateless JWT access tokens; passwords hashed with argon2 (memory-hard).
- **Authorization:** role-based Provider/Admin guards enforce access at the route boundary.
- **Network:** RDS is private inside the VPC and not publicly accessible; only the app security group can reach it. nginx fronts the API, which is never exposed to the internet directly.
- **Transport:** HTTPS everywhere via an ACM cert on the ALB, with an 80→443 redirect.
- **Secrets:** live only in AWS Secrets Manager — never in the repo, in any subfolder, or in Terraform state.
- **Cloud credentials:** GitHub Actions uses OIDC federation; there are no long-lived AWS keys stored in CI.

## Repository structure

```
ai-clinical-scribe/
├── backend/              NestJS API — tiered DDD (encounter & scribe hexagonal; rest flat)
│   └── src/contexts/     encounter, scribe, identity, patient, template, coding, audit, admin, auth
├── frontend/             React + Vite + Tailwind SPA
├── packages/
│   └── contracts/        Shared TS types: SOAP schema, DTOs, SSE event union (single source of truth)
├── infra/                Terraform (modules + prod env) and deploy scripts
├── docs/                 Deployment plan, implementation phases
└── docker-compose.yml    Local Postgres + api + web
```

## Known limitations and roadmap

Named honestly — each is a deliberate scope cut for a time-boxed take-home, with the fix I would make next.

- **Single ECS task runs both web and api on one EC2 instance** → split into a dedicated service/instance per tier so frontend and backend deploy and scale independently.
- **Backend sits behind the shared ALB via nginx loopback** → give the backend its own load balancer / target group with horizontal scaling.
- **Automated RDS backups are off (retention = 0) and the instance is single-AZ** (free-tier constraints) → enable daily automated snapshots + point-in-time recovery and Multi-AZ failover before storing real data.
- **The app connects as the RDS master user** → create a least-privilege application role scoped to only the tables it needs.
- **CI/CD has no security gates** → add dependency/SAST and container image scanning (e.g. Trivy), failing the build on high-severity findings.
- **No RDS Proxy** (free tier) → enable it for connection pooling/multiplexing and smoother failover at scale.
- **WAF and CloudWatch alarms exist as Terraform toggles but are off** → enable managed WAF rules + rate limiting and SLO-based alerting for production.
- **Minimal observability** → add structured logging, metrics, error tracking, and distributed tracing (e.g. Sentry/Datadog).
- **ECS service is fixed at one task on a tight t3.small** → add service autoscaling and right-size the instances.
- **The demo HTTPS domain is temporary** (removed ~1 week post-submission) → HTTPS is a Terraform toggle re-pointable to any permanent domain.
