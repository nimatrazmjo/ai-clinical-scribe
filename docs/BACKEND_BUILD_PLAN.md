# Backend Build Plan — AI Clinical Scribe (NestJS)

**Version:** 1.0 · **Scope:** Backend only (NestJS API) · **Author:** Nimat Razmjo · **Date:** 2026-07-16
**Traces to:** `docs/SRS.md` v0.2 · **Governed by:** `backend/CLAUDE.md`

---

## 0. How to use this backlog

This is a JIRA-style ticket backlog. Each ticket (`BE-XX`) is a **single, self-contained slice**
sized for one focused implementation session. Do **not** batch multiple tickets into one prompt —
implement one, get it green, commit, then pick up the next. Every ticket ends with the same ritual:
**typecheck → lint → tests → coverage gate → commit.**

Each ticket carries: dependencies, SRS trace, in-scope / explicitly-out-of-scope, implementation
notes (files + signatures), an exhaustive test list (unit / integration / e2e with edge cases
called out), acceptance criteria, and the exact commit message.

**Read order:** §1 testing standards → §2 edge-case master catalogue → §3 sequence graph → §4 the
tickets. The catalogue in §2 is the checklist that proves "all edge cases covered" — every row maps
to the ticket that owns it.

Starting point (verified): backend is a clean `nest new` scaffold (NestJS 11, Jest 30 + ts-jest,
TS 5.7). No TypeORM, no auth, no feature code. BE-01 builds on top of that.

---

## 1. Testing standards (applies to every ticket)

### 1.1 The pyramid

- **Unit (most tests):** domain aggregates/VOs, use cases, guards, pipes, services, the guardrail,
  the prompt assembler, the output parser. Pure Jest, no I/O. All ports mocked.
- **Integration (repositories + DB-touching code):** run against a **real Postgres via
  Testcontainers** (`@testcontainers/postgresql`; `pgvector/pgvector:pg16` image where vectors are
  needed). No mocking the DB — we assert real SQL behavior (constraints, ordering, pooling).
- **e2e (HTTP contract):** boot the Nest app with Supertest against a Testcontainers Postgres and a
  **faked LLM adapter**. Assert status codes, response shapes, RBAC, streaming events, and
  no-data-loss guarantees.

### 1.2 Determinism enablers (build these once, in BE-01/BE-02, reuse everywhere)

- **`FakeLlmProvider`** implements the `LlmProvider` port and replays **scripted** streams. Canned
  scenarios it must support: (a) clean 4-section SOAP with ICD-10, (b) tool-call turn → history →
  final SOAP, (c) malformed/off-schema output, (d) mid-stream error/timeout, (e) empty/refusal.
  This is what makes streaming + tool-calling + guardrails testable without a live model.
- **`Clock` port** (`now(): Date`) injected everywhere time matters (JWT exp, version timestamps,
  date-range filters). Tests use a `FixedClock`. Never call `new Date()` in domain/application code.
- **`IdGenerator` port** for deterministic IDs in tests.
- **`FakeSecretsProvider`** for config in tests (no AWS in CI).

### 1.3 Coverage gates (enforced in CI script, wired in BE-01)

- Domain + application layers: **≥ 95% lines/branches**. These have no excuse to be uncovered.
- Infrastructure + interface layers: **≥ 80%**.
- A ticket is not "done" if it drops global coverage below the gate. `jest --coverage` must pass.

### 1.4 Jest project layout (configured in BE-01)

Three Jest projects: `unit` (`*.spec.ts`, default, fast, no containers), `integration`
(`*.int-spec.ts`, spins a container), `e2e` (`*.e2e-spec.ts`, boots app + container). Scripts:
`test:unit`, `test:int`, `test:e2e`, `test:cov`, `test:ci` (all three + coverage).

### 1.5 Definition of Done (every ticket)

1. `pnpm -C backend tsc --noEmit` clean.
2. `pnpm -C backend lint` clean.
3. All new + existing tests green (`test:ci`).
4. Coverage gate holds.
5. No secret, token, password, or PHI-bearing content in logs or committed files.
6. Conventional-commit message exactly as specified in the ticket.

### 1.6 Commit convention

Conventional Commits: `type(scope): summary`. Types used: `feat`, `test`, `fix`, `refactor`,
`chore`, `docs`. Scope = context name (`auth`, `encounter`, `scribe`, …). Tests may land in the
same commit as the feature (preferred) — the ticket's commit line is the single squashed message.

---

## 2. Edge-case master catalogue (the "all edge cases" checklist)

Every row is an edge case the backend must handle, with the ticket that owns its test. If a row is
red at submission, that's a known gap — not a surprise.

| #    | Area       | Edge case                                       | Expected behavior                                                                      | Owned by |
| ---- | ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| E-01 | Auth       | Invalid credentials                             | 401, generic message, no user enumeration                                              | BE-06    |
| E-02 | Auth       | Deactivated provider logs in                    | 401/403, distinct from bad-password path internally, generic externally                | BE-06    |
| E-03 | Auth       | Missing `Authorization` header                  | 401                                                                                    | BE-07    |
| E-04 | Auth       | Malformed / tampered / wrong-signature JWT      | 401, no stack leak                                                                     | BE-07    |
| E-05 | Auth       | Expired JWT on a read request                   | 401 with machine-readable `code: TOKEN_EXPIRED`                                        | BE-07    |
| E-06 | Auth       | Token for a since-deactivated user              | 401/403 even if signature valid (live is_active check)                                 | BE-07    |
| E-07 | RBAC       | Provider requests another provider's encounter  | 403; also filtered at query level                                                      | BE-11    |
| E-08 | RBAC       | Provider hits an admin route                    | 403                                                                                    | BE-07    |
| E-09 | Patient    | Same name+DOB submitted twice                   | Resolves to the same patient (no duplicate)                                            | BE-08    |
| E-10 | Patient    | Name casing / whitespace / diacritics differ    | Normalized match key still matches                                                     | BE-08    |
| E-11 | Patient    | Future or impossible DOB                        | 400 validation                                                                         | BE-08    |
| E-12 | Patient    | Same name, different DOB                        | Distinct patients                                                                      | BE-08    |
| E-13 | Encounter  | Autosave races (rapid edits)                    | Last-write-wins on draft only; no error                                                | BE-11    |
| E-14 | Encounter  | Oversized transcript (> limit)                  | 400 with size message                                                                  | BE-11    |
| E-15 | Encounter  | Start encounter with blank patient fields       | 400 validation                                                                         | BE-11    |
| E-16 | Encounter  | Draft edit on an already-finalized encounter    | 409 conflict                                                                           | BE-11    |
| E-17 | Gen (AI)   | Empty transcript                                | Guardrail refuses **before** any LLM call; no note                                     | BE-13    |
| E-18 | Gen (AI)   | Whitespace-only / gibberish / non-clinical text | Guardrail refuses gracefully                                                           | BE-13    |
| E-19 | Gen (AI)   | PII-only, no clinical content                   | Refuses (no hallucinated SOAP)                                                         | BE-13    |
| E-20 | Gen (AI)   | LLM timeout / 5xx mid-stream                    | Stream emits `error` event; no partial DB write                                        | BE-15    |
| E-21 | Gen (AI)   | LLM returns off-schema / unparseable output     | Parse guard → controlled error, not a 500 dump                                         | BE-14    |
| E-22 | Gen (AI)   | LLM returns zero ICD-10 codes                   | Enforce ≥1 (re-ask or flag), never silently empty                                      | BE-14    |
| E-23 | Gen (AI)   | Client aborts stream (AbortController)          | Server detects disconnect, stops, no orphan write                                      | BE-15    |
| E-24 | Gen (AI)   | Model requests an unregistered tool             | Rejected safely, generation continues/aborts cleanly                                   | BE-16    |
| E-25 | Gen (AI)   | Prompt-injection text in transcript             | System prompt hardened; injected instructions ignored                                  | BE-12    |
| E-26 | History    | Returning patient                               | History injected via tool call; output references priors                               | BE-16    |
| E-27 | History    | First-time patient                              | No history; tool returns empty; output differs demonstrably                            | BE-16    |
| E-28 | Versioning | First save                                      | Creates version 1                                                                      | BE-18    |
| E-29 | Versioning | Concurrent saves to same encounter              | Unique `(encounter_id, version_no)` blocks dup; retry increments                       | BE-17    |
| E-30 | Versioning | Any UPDATE/DELETE attempt on note_versions      | Rejected by repo + DB; test proves immutability                                        | BE-17    |
| E-31 | Versioning | Re-save with identical content                  | Still a new version (audit fidelity)                                                   | BE-18    |
| E-32 | Session    | **Expired token at save time**                  | Draft preserved server-side; 401 `TOKEN_EXPIRED`; re-auth replays save, zero data loss | BE-19    |
| E-33 | Template   | Admin edits active template mid-session         | Provider's next generation uses new template, no restart                               | BE-23    |
| E-34 | Template   | Delete a template currently selected            | Falls back to default; no crash                                                        | BE-23    |
| E-35 | ICD-10     | Empty search query                              | 400 validation                                                                         | BE-22    |
| E-36 | ICD-10     | Query with no strong match                      | Returns best-effort ranked list or empty gracefully                                    | BE-22    |
| E-37 | ICD-10     | Non-medical query                               | Low-relevance handled, no error                                                        | BE-22    |
| E-38 | Admin      | Add provider with duplicate email               | 409 conflict                                                                           | BE-24    |
| E-39 | Admin      | Deactivate provider with an open draft          | Provider locked out next request; draft row preserved                                  | BE-24    |
| E-40 | Admin      | Date-range filter boundaries                    | Inclusive start, exclusive end; TZ-safe                                                | BE-24    |
| E-41 | Infra      | Missing required secret at boot                 | Fail fast with clear error, app does not start half-configured                         | BE-03    |
| E-42 | Infra      | DB unreachable at boot                          | Fail fast; `/health` reflects DB status when up                                        | BE-01/03 |
| E-43 | Infra      | Per-request DB connection introduced            | Prevented; test asserts single pooled DataSource                                       | BE-03    |
| E-44 | Global     | Malformed JSON / unknown fields in any DTO      | 400 via global `ValidationPipe({ whitelist, forbidNonWhitelisted })`                   | BE-01    |
| E-45 | Global     | Unhandled exception                             | Global filter → sanitized JSON, correct status, no stack leak                          | BE-01    |
| E-46 | Global     | Auth + generate endpoints hammered              | Rate-limited (429)                                                                     | BE-26    |

---

## 3. Ticket sequence & dependency graph

```
Foundation:   BE-01 ─▶ BE-02 ─▶ BE-03
Identity/Auth: BE-03 ─▶ BE-04 ─▶ BE-05 ─▶ BE-06 ─▶ BE-07
Patient:       BE-03 ─▶ BE-08
Encounter:     BE-02 ─▶ BE-09 ─▶ BE-10 ─▶ BE-11  (BE-11 needs BE-07, BE-08)
Scribe:        BE-09 ─▶ BE-12 ─▶ BE-13 ─▶ BE-14 ─▶ BE-15  (BE-15 needs BE-11)
History:       BE-15 + BE-18 ─▶ BE-16
Versioning:    BE-10 ─▶ BE-17 ─▶ BE-18 ─▶ BE-1t
Audit:         BE-02 ─▶ BE-20  (subscribes to events from BE-11/18/24)
Coding:        BE-03 ─▶ BE-21 ─▶ BE-22
Template:      BE-03 ─▶ BE-23  (BE-14 reads active template)
Admin:         BE-07 + BE-18 ─▶ BE-24
Pioneer:       BE-18 ─▶ BE-25
Hardening:     everything ─▶ BE-26
```

**Critical path to a demoable core loop (do these first, in order):**
BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06 → BE-07 → BE-08 → BE-09 → BE-10 → BE-11 → BE-12 →
BE-13 → BE-14 → BE-15 → BE-17 → BE-18 → BE-19. Everything after (BE-16, BE-20..BE-26) is
differentiator or hardening and can be cut from the bottom under time pressure.

---

## 4. Tickets

---

### BE-01 — Test harness, global pipes/filter, health endpoint

- **Epic:** Foundation · **Depends on:** — · **SRS:** NFR-MAINT-01, C-2, E-42/E-44/E-45
- **Story:** As a developer, I need a deterministic test harness and app skeleton so every later
  ticket can be built test-first.
- **Why:** Nothing else is defensible without the pyramid and the container-backed DB in place.
- **In scope:**
  - Add deps: `@nestjs/config`, `@nestjs/typeorm` + `typeorm` + `pg`, `class-validator`,
    `class-transformer`, `@testcontainers/postgresql` (dev), `pgvector` (later).
  - Configure **three Jest projects** (`unit` / `integration` / `e2e`) per §1.4; add
    `test:unit|int|e2e|cov|ci` scripts; set coverage thresholds per §1.3 in Jest config.
  - Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
  - Global `AllExceptionsFilter` → sanitized JSON envelope `{ statusCode, code, message }`, no
    stack in prod, structured log (no PHI/secret).
  - `GET /health` → `{ status, db: 'up'|'down' }` (db check wired in BE-03; stub 'unknown' now).
  - `test/support/`: `createTestApp()` helper, `TestDb` Testcontainers wrapper (starts once per
    integration/e2e run), shared fixtures barrel.
- **Out of scope (do NOT):** any real DataSource wiring (BE-03), any auth, any domain code.
- **Implementation notes:** keep `main.ts` thin — pipes/filter registered in an `AppBootstrap`
  helper reused by `createTestApp()` so prod and tests share config.
- **Tests:**
  - unit: `AllExceptionsFilter` maps a thrown `DomainException`/`HttpException`/unknown error to
    the right status + envelope; never leaks a stack (E-45).
  - unit: `ValidationPipe` rejects unknown fields and bad types on a sample DTO (E-44).
  - e2e: `GET /health` → 200 shape correct.
  - e2e: unknown route → 404 envelope; malformed JSON body → 400 envelope.
- **Acceptance:** `pnpm -C backend test:ci` runs all three projects green; coverage gate active.
- **Commit:** `chore(core): test harness, global validation/exception filter, health endpoint`

---

### BE-02 — Shared kernel (base classes + Clock/Id ports)

- **Epic:** Foundation · **Depends on:** BE-01 · **SRS:** §Design tactical DDD
- **Story:** As a developer, I need DDD base primitives so aggregates and use cases are consistent.
- **In scope:** `src/shared-kernel/`:
  - `AggregateRoot` (records + pulls domain events), `Entity`, `ValueObject` (structural equality),
    `DomainEvent`, `DomainException` (base for typed domain errors), `Result<T>`/`Guard` helpers,
    branded ID types (`UserId`, `PatientId`, `EncounterId`, …) via a `UniqueId` base.
  - Ports: `Clock` (`now()`), `IdGenerator` (`uuid()`); implementations `SystemClock`,
    `UuidGenerator`; test doubles `FixedClock`, `SeqIdGenerator`.
- **Out of scope:** any persistence, any context-specific model.
- **Tests (unit only, target ≥95%):**
  - `ValueObject` equality: equal by value, unequal on any field diff, immutability enforced.
  - `AggregateRoot` records events and `pullEvents()` clears them.
  - branded IDs reject empty/invalid input; two IDs equal iff same value.
  - `FixedClock` returns the set instant; `SeqIdGenerator` is deterministic.
- **Acceptance:** shared kernel importable, zero framework imports in these files.
- **Commit:** `feat(core): DDD shared kernel with Clock and Id ports`

---

### BE-03 — Persistence foundation (pooled DataSource, config/secrets port, migrations)

- **Epic:** Foundation · **Depends on:** BE-02 · **SRS:** C-1, C-2, C-3, E-41, E-43
- **Story:** As a developer, I need one pooled DB connection and boot-time config so all
  repositories share a single DataSource.
- **In scope:**
  - `SecretsProvider` port (`get(key): Promise<string>`); `EnvSecretsProvider` (local/test),
    interface only for `AwsSecretsProvider` (wired in infra, not here). App **fails fast** if a
    required key is missing (E-41).
  - `DatabaseModule`: single TypeORM `DataSource` as a Nest singleton, pool `max: 10`,
    `synchronize: false`, migrations dir configured. Export a typed `DATA_SOURCE` token.
  - Migration tooling + first migration (extensions only, e.g. `pgcrypto`; `vector` added in BE-21).
  - Wire `/health` DB check (E-42).
- **Out of scope:** any table/entity (those live in each context's ticket).
- **Tests:**
  - unit: config loader throws a clear error when a required secret is absent (E-41).
  - integration (Testcontainers): DataSource connects; a trivial `SELECT 1` succeeds through the
    pool; assert the app holds **one** DataSource instance (no per-request creation) (E-43).
  - e2e: `/health` reports `db: 'up'` against the container.
- **Acceptance:** app boots against a container DB; missing-secret path fails fast.
- **Commit:** `feat(core): pooled TypeORM DataSource, secrets port, migration tooling`

---

### BE-04 — Identity: User model + persistence + demo seed

- **Epic:** Identity · **Depends on:** BE-03 · **SRS:** FR-AUTH-01/02, DR-\*, E-02
- **Story:** As the system, I persist users with roles so authentication and RBAC have a source of
  truth.
- **In scope:**
  - Flat-tier context (`contexts/identity`): `User` (id, role `provider|admin`, email, first/last,
    `passwordHash`, `isActive`, timestamps). TypeORM entity + migration (`users`, unique email).
  - `UserRepository` (find by email, by id, save). Query methods only — no domain ports (flat tier).
  - Seed script: **3 providers + 1 admin** with argon2-hashed demo passwords, idempotent
    (`ON CONFLICT DO NOTHING`), no plaintext in the repo — read demo passwords from config/seed
    input, document them in `backend/README.md` (demo only).
- **Out of scope:** hashing service impl (BE-05 provides it; seed consumes it), login/JWT (BE-06).
- **Tests:**
  - integration: save + find-by-email round-trips; duplicate email → unique-violation surfaced as
    a domain-friendly conflict.
  - integration: seed is idempotent (run twice → 4 users, not 8).
  - integration: `isActive=false` user is retrievable and flagged (feeds E-02).
- **Acceptance:** seeded DB has exactly 3 providers + 1 admin; emails unique.
- **Commit:** `feat(identity): user entity, repository, and idempotent demo seed`

---

### BE-05 — Identity: password hashing service (argon2)

- **Epic:** Identity · **Depends on:** BE-02 · **SRS:** FR-AUTH-05
- **Story:** As the system, I hash and verify passwords so credentials are never stored or compared
  in plaintext.
- **In scope:** `PasswordHasher` port + `Argon2PasswordHasher` adapter (`hash`, `verify`). Sensible
  argon2id params. Add `argon2` dep.
- **Out of scope:** where it's called (seed/login) — just the service.
- **Tests (unit):**
  - hash of a password verifies true; wrong password verifies false.
  - two hashes of the same input differ (unique salt).
  - `verify` against a malformed/empty hash returns false, never throws (defensive).
  - never logs the plaintext (assert logger not called with the secret).
- **Acceptance:** deterministic verify semantics; no plaintext anywhere.
- **Commit:** `feat(identity): argon2 password hashing service`

---

### BE-06 — Auth: login use case + JWT issuance + `POST /auth/login`

- **Epic:** Identity · **Depends on:** BE-04, BE-05 · **SRS:** FR-AUTH-03, E-01, E-02
- **Story:** As a user, I log in with email+password and receive a signed token.
- **In scope:**
  - `TokenService` port + `JwtTokenService` adapter (`@nestjs/jwt`), signs `{ sub, role, iat, exp }`
    using a secret from `SecretsProvider`; `exp` computed via `Clock` (testable).
  - `LoginUseCase`: look up user → verify hash → reject if `!isActive` → issue token.
  - `AuthController` `POST /auth/login` with `LoginDto` (email, password) validated.
- **Out of scope:** guards (BE-07), refresh tokens (note as future), password reset.
- **Tests:**
  - unit (use case): valid creds → token with correct `sub`/`role`/`exp` (FixedClock);
    wrong password → `InvalidCredentials` (E-01); deactivated user → `InvalidCredentials`
    externally (E-02) but distinguishable in logs/metrics internally.
  - unit: `JwtTokenService` sign→verify round-trips; tampered token fails verify.
  - e2e: `POST /auth/login` happy path → 200 + token; bad password → 401 generic (no
    user-enumeration difference in body/timing note); deactivated → 401; malformed body → 400.
- **Acceptance:** all four e2e branches pass; body identical for bad-password vs unknown-email.
- **Commit:** `feat(auth): login use case, JWT issuance, and login endpoint`

---

### BE-07 — Auth: JwtAuthGuard, RolesGuard, `@CurrentUser`, live is_active check

- **Epic:** Identity · **Depends on:** BE-06 · **SRS:** FR-AUTH-04, E-03..E-06, E-08
- **Story:** As the system, I protect routes by authentication and role so users only reach what
  they're authorized for.
- **In scope:**
  - `JwtAuthGuard` (verifies token, loads user, **re-checks `isActive` live** so a deactivated
    user's still-valid token is rejected — E-06).
  - `RolesGuard` + `@Roles(...)` decorator; `@CurrentUser()` param decorator.
  - `@Auth(...roles)` composite (from `backend/.claude` convention) applying both guards.
  - Error envelopes: expired → `code: TOKEN_EXPIRED` (needed by BE-19).
- **Out of scope:** per-resource ownership (that's query-level, in BE-11/18).
- **Tests:**
  - unit (guards): missing header → 401 (E-03); malformed/wrong-signature → 401 (E-04); expired →
    401 `TOKEN_EXPIRED` (E-05, FixedClock past exp); valid provider token on admin-only route →
    403 (E-08); token for now-deactivated user → 401/403 (E-06).
  - e2e: a throwaway protected `GET /me` exercises the full matrix above through real HTTP.
- **Acceptance:** the full 401/403 matrix is green via both unit and e2e.
- **Commit:** `feat(auth): jwt + roles guards, current-user decorator, live active check`

---

### BE-08 — Patient: aggregate + resolve-or-create identity service

- **Epic:** Patient · **Depends on:** BE-03 · **SRS:** FR-HIST-01, E-09..E-12
- **Story:** As the system, I match patients by name+DOB so returning patients are recognized.
- **In scope:**
  - `contexts/patient` (flat tier): `Patient` (id, first, last, dob, `matchKey`) entity + migration
    (unique `match_key`).
  - `matchKey` = deterministic normalization of `lower(trim(unaccent(first)))|last|dob`.
  - `PatientIdentityService.resolveOrCreate({first,last,dob})` → returns existing or creates.
  - DOB validation (not future, plausible range).
- **Out of scope:** history retrieval (BE-16), any encounter linkage.
- **Tests:**
  - unit: match-key normalization — casing, surrounding whitespace, diacritics all collapse to the
    same key (E-10); different DOB → different key (E-12).
  - integration: `resolveOrCreate` twice with same identity → one row (E-09); concurrent
    resolve → unique constraint prevents dupes, second resolves to the first.
  - unit: future DOB → validation error (E-11); missing fields → validation error (E-15-adjacent).
- **Acceptance:** dedupe holds under repeat + concurrent calls.
- **Commit:** `feat(patient): patient aggregate and resolve-or-create identity service`

---

### BE-09 — Encounter: domain model (aggregate, SOAP value objects, status machine)

- **Epic:** Encounter (full hexagonal) · **Depends on:** BE-02 · **SRS:** FR-ENC-\*, FR-GEN-02/03
- **Story:** As the system, I model the encounter and note structure in a pure domain layer so
  invariants are enforced by construction.
- **In scope (`contexts/encounter/domain/`, zero framework/ORM imports):**
  - `Encounter` aggregate: `patientRef`, `providerRef`, `status` (`Draft|Finalized`),
    `transcript`, `selectedTemplateRef`, `workingDraft`. Guards on transitions
    (can't edit draft once `Finalized`).
  - VOs: `SoapNote { subjective, objective, assessment: Assessment, plan }`,
    `Assessment { text, icd10: Icd10Suggestion[] }`, `Icd10Suggestion { code, description }`,
    `Transcript` (length bounds), `EncounterStatus`.
  - Domain events: `EncounterStarted`, `DraftUpdated`, `EncounterFinalized`.
- **Out of scope:** persistence (BE-10), use cases/HTTP (BE-11), generation (BE-12+).
- **Tests (unit only, ≥95%):**
  - `Transcript` rejects empty and over-limit input (feeds E-14/E-17).
  - `SoapNote` requires all four sections; `Assessment` requires ≥1 ICD-10 (feeds E-22).
  - status machine: editing draft after `Finalized` throws (E-16); valid finalize transitions.
  - events recorded on start/update/finalize and cleared on pull.
- **Acceptance:** domain compiles with no Nest/TypeORM import; invariants covered.
- **Commit:** `feat(encounter): domain aggregate, SOAP value objects, status machine`

---

### BE-10 — Encounter: persistence (repository, mapper, migration)

- **Epic:** Encounter · **Depends on:** BE-09 · **SRS:** C-1, DR-02
- **Story:** As the system, I persist encounters and drafts to RDS via an explicit domain↔ORM
  mapper so the domain stays clean.
- **In scope:**
  - `encounters` migration (FKs to patients/users/templates, `status`, `current_transcript`,
    `working_draft_json`, timestamps; indexes on `provider_id`, `patient_id`).
  - `EncounterOrmEntity` (TypeORM) + `EncounterMapper` (domain ⇄ ORM), `EncounterRepository`
    implementing the domain port (`findById`, `findByProvider`, `save`).
- **Out of scope:** note_versions table (BE-17), use cases (BE-11).
- **Tests (integration, Testcontainers):**
  - round-trip: save aggregate → reload → deep-equal domain object (mapper fidelity).
  - `findByProvider` returns only that provider's rows (feeds E-07).
  - `working_draft_json` persists and rehydrates (feeds draft restore).
- **Acceptance:** mapper is lossless; queries indexed.
- **Commit:** `feat(encounter): repository, orm mapper, and migration`

---

### BE-11 — Encounter: start-encounter + draft-autosave use cases + endpoints

- **Epic:** Encounter · **Depends on:** BE-10, BE-07, BE-08 · **SRS:** FR-ENC-01/02/06, FR-SESS-01/02, E-07/E-13/E-14/E-15/E-16
- **Story:** As a provider, I start an encounter and my draft autosaves so I never lose work.
- **In scope:**
  - `StartEncounterUseCase` (resolves patient via Patient facade, creates draft encounter).
  - `UpdateDraftUseCase` (debounced autosave target; last-write-wins on `workingDraft`).
  - Endpoints: `POST /encounters`, `PATCH /encounters/:id/draft`, `GET /encounters/:id`,
    `GET /encounters` (provider-scoped). All `@Auth('provider')`.
  - **Ownership enforced in the query** (`WHERE provider_id = :callerId`), not just the guard (E-07).
  - Prompt-injection note: transcript is stored raw but never concatenated into system-prompt
    position (hardening verified in BE-12) (E-25).
- **Out of scope:** generation, saving finalized versions (BE-18).
- **Tests:**
  - unit (use cases): start resolves/creates patient then persists draft; blank patient fields →
    validation error (E-15); oversized transcript → 400 (E-14).
  - integration: rapid `UpdateDraft` calls → final state is last write, no error (E-13).
  - e2e: provider A cannot GET provider B's encounter → 403/empty (E-07); draft persists and
    `GET` rehydrates it (FR-SESS-02); PATCH draft on a finalized encounter → 409 (E-16).
- **Acceptance:** ownership scoping proven at query level; draft survives reload.
- **Commit:** `feat(encounter): start-encounter and draft-autosave use cases with ownership scoping`

---

### BE-12 — Scribe: ports, FakeLlmProvider, prompt assembler

- **Epic:** Scribe (full hexagonal) · **Depends on:** BE-09 · **SRS:** AI-FR-01/02/03/05, E-25
- **Story:** As the system, I define the LLM boundary and a deterministic fake so generation is
  testable without a live model.
- **In scope (`contexts/scribe/`):**
  - Ports (`domain/ports`): `LlmProvider.stream(ctx, tools): AsyncIterable<LlmEvent>`,
    `GenerationTool { name, schema, execute }`, `OutputGuardrail`.
  - `FakeLlmProvider` (test infra) replaying the five scripted scenarios from §1.2.
  - `PromptAssembler`: composes system prompt + active template + transcript + tool results.
    **System instructions and user transcript are kept in separate roles** — transcript never
    occupies the instruction slot (prompt-injection hardening, E-25).
- **Out of scope:** the real vendor adapter (add later/infra), orchestration (BE-14), HTTP (BE-15).
- **Tests (unit):**
  - `PromptAssembler` places transcript in the user role, template in the system role; injected
    "ignore previous instructions" text stays in user content and doesn't alter assembled system
    prompt (E-25).
  - `FakeLlmProvider` yields each scripted scenario deterministically (sanity for later tickets).
- **Acceptance:** ports + fake usable by BE-13/14/15; no vendor SDK type in domain.
- **Commit:** `feat(scribe): llm ports, deterministic fake provider, prompt assembler`

---

### BE-13 — Scribe: empty/non-clinical input guardrail (EDGE CASE #1)

- **Epic:** Scribe · **Depends on:** BE-12 · **SRS:** FR-EDGE-01, AI-SAFE-01/02, E-17/E-18/E-19
- **Story:** As a provider, if I submit meaningless input the system declines rather than inventing
  a note.
- **In scope:** `EmptyContentGuardrail implements OutputGuardrail` — runs **before any LLM call**;
  returns a refusal verdict for empty, whitespace-only, gibberish, or non-clinical text. Heuristic +
  optional cheap classifier call (behind the port, faked in tests).
- **Out of scope:** the streaming refusal wire-up (BE-15 consumes the verdict).
- **Tests (unit, edge-heavy):**
  - empty string, whitespace-only, punctuation-only → refuse (E-17/E-18).
  - random gibberish / lorem ipsum → refuse (E-18).
  - PII-only ("John Smith, 123 Main St, DOB…") with no clinical content → refuse (E-19).
  - genuine clinical snippet ("c/o chest pain x2 days, SOB") → allow.
  - refusal carries a structured reason, not a generated SOAP note.
- **Acceptance:** guardrail never allows a fabricated note through on meaningless input.
- **Commit:** `feat(scribe): empty/non-clinical input guardrail (no-hallucination edge case)`

---

### BE-14 — Scribe: GenerateNote orchestrator + structured-output parsing

- **Epic:** Scribe · **Depends on:** BE-13, BE-23-read · **SRS:** FR-GEN-02/03/04/06, AI-FR-04, E-21/E-22
- **Story:** As the system, I orchestrate a generation: guardrail → assemble → call LLM → parse into
  the SOAP schema.
- **In scope:** `GenerateNoteUseCase` (application): runs guardrail (short-circuit on refuse);
  reads the **active template at call time** (live read — supports live propagation E-33); calls
  `LlmProvider`; parses/validates the structured output into `SoapNote`; enforces ≥1 ICD-10.
- **Out of scope:** SSE transport (BE-15), history tool (BE-16), persistence.
- **Tests (unit, FakeLlmProvider):**
  - happy scenario → valid `SoapNote`, 4 sections, ≥1 ICD-10.
  - refusal scenario → returns refusal, LLM **not** called (assert provider unused) (E-17).
  - off-schema/unparseable output → controlled `GenerationFailed`, not a raw 500 (E-21).
  - zero-ICD-10 output → enforced re-ask or explicit flag, never silently empty (E-22).
  - swapping the active template changes the assembled prompt (E-33 unit-level).
- **Acceptance:** orchestrator handles all four model outcomes deterministically.
- **Commit:** `feat(scribe): generate-note orchestrator with structured output parsing`

---

### BE-15 — Scribe: SSE streaming endpoint (progressive, cancel, refusal path)

- **Epic:** Scribe · **Depends on:** BE-14, BE-11 · **SRS:** FR-GEN-01/05, AI-FR-05, NFR-PERF-01, E-20/E-23
- **Story:** As a provider, I watch the note stream in progressively and can cancel it.
- **In scope:** `GenerationController` `POST /encounters/:id/generate` returning an SSE stream
  (`Content-Type: text/event-stream`). Event types: `section-delta`, `tool-call`, `refused`,
  `error`, `done`. Handles client disconnect (abort) and LLM mid-stream failure without a partial
  DB write. `@Auth('provider')` + ownership check.
- **Out of scope:** saving the result (that's an explicit save, BE-18).
- **Tests (e2e with Supertest reading the stream + FakeLlmProvider):**
  - happy: receives ordered `section-delta` events then `done`; assembled note has 4 sections.
  - refusal scenario → single `refused` event, no `section-delta`, no note (E-17 end-to-end).
  - LLM mid-stream error → `error` event, connection closes cleanly, **no** note/version persisted
    (E-20).
  - client aborts mid-stream → server stops generation, no orphan write (E-23).
  - non-owner provider → 403 before streaming starts (E-07).
- **Acceptance:** progressive rendering proven by event ordering; failure paths leave no residue.
- **Commit:** `feat(scribe): SSE streaming generation endpoint with cancel and failure handling`

---

### BE-16 — History injection: GetPatientHistoryTool + wiring (returning vs new)

- **Epic:** Scribe · **Depends on:** BE-15, BE-18 · **SRS:** FR-HIST-02/03/04, E-24/E-26/E-27
- **Story:** As a provider seeing a returning patient, the AI references their prior encounters via
  a server-side tool call.
- **In scope:** `GetPatientHistoryTool implements GenerationTool` → calls the Encounter context's
  read facade (`NoteVersionQuery.getHistoryForPatient(patientId)`, relevance/recency ranked).
  Register in the scribe tool registry; wire the tool-call turn in the orchestrator. Reject
  unregistered tool names safely.
- **Out of scope:** frontend prompt anything (history is **never** sent from the client).
- **Tests:**
  - unit: tool returns ranked prior notes; empty for a first-time patient (E-27).
  - unit: orchestrator handles the scripted "tool-call → history → SOAP" scenario; a request for an
    unregistered tool is rejected without crashing generation (E-24).
  - e2e: returning patient → generated note references priors; brand-new patient → no history,
    output demonstrably differs (E-26/E-27). Assert history came via the tool path, not the request
    body.
- **Acceptance:** returning-vs-new divergence is demonstrable and server-side only.
- **Commit:** `feat(scribe): server-side patient-history tool injection`

---

### BE-17 — Versioning: NoteVersion aggregate + append-only repo + unique constraint

- **Epic:** Encounter/Versioning (full hexagonal) · **Depends on:** BE-10 · **SRS:** FR-VER-01/04, DR-01, E-29/E-30
- **Story:** As the system, I store note versions immutably so the clinical record is auditable.
- **In scope:**
  - `NoteVersion` aggregate (own aggregate, referenced by `encounterId`): `versionNo`, `SoapNote`,
    `savedBy`, `savedAt`.
  - `note_versions` migration with **unique `(encounter_id, version_no)`** and FK to users
    (`saved_by`); index `(encounter_id, version_no)`.
  - `NoteVersionRepository`: `nextVersionNo`, `append`, `listByEncounter`. **No update/delete
    methods exist** — append-only by construction.
  - `NoteVersioningService` computes next version number transactionally.
- **Out of scope:** the save use case/endpoint (BE-18).
- **Tests (integration, Testcontainers):**
  - append v1, v2, v3 → monotonically increasing `version_no`, none overwritten (E-28/E-31).
  - concurrent append with same `version_no` → unique violation; retry yields next number (E-29).
  - attempt to UPDATE or DELETE a note_version via raw query → rejected/absent; repo exposes no such
    method; test asserts immutability (E-30).
  - `listByEncounter` ordered by `version_no`, includes `savedBy`/`savedAt` (FR-VER-02).
- **Acceptance:** append-only proven under concurrency; no mutation path exists.
- **Commit:** `feat(encounter): append-only note-version aggregate, repository, unique constraint`

---

### BE-18 — Versioning: SaveNoteVersion use case + save + history endpoints

- **Epic:** Encounter/Versioning · **Depends on:** BE-17, BE-11 · **SRS:** FR-ENC-05, FR-VER-02/03, E-28/E-31
- **Story:** As a provider, each save writes a new immutable version I can review later.
- **In scope:**
  - `SaveNoteVersionUseCase`: in one transaction — compute next version, append `NoteVersion`,
    mark encounter `Finalized`, clear working draft, emit `NoteSaved` domain event.
  - Endpoints: `POST /encounters/:id/notes` (save), `GET /encounters/:id/versions` (history),
    `GET /encounters/:id/versions/:n` (one version). `@Auth('provider')` + ownership.
- **Out of scope:** audit persistence (BE-20 subscribes to `NoteSaved`), diff (BE-25).
- **Tests:**
  - unit: first save → v1 (E-28); re-save identical content → still a new version (E-31);
    save emits `NoteSaved`.
  - e2e: save → 201 with version 1; edit + save → version 2; history lists both with who/when in
    order; non-owner save → 403; each version immutable on re-read.
- **Acceptance:** version history is complete, ordered, attributed, immutable.
- **Commit:** `feat(encounter): save-note-version use case with version-history endpoints`

---

### BE-19 — Session: expired-token-at-save, no data loss (EDGE CASE #2)

- **Epic:** Identity/Encounter · **Depends on:** BE-07, BE-18 · **SRS:** FR-EDGE-02, FR-AUTH-06, E-32
- **Story:** As a provider whose session expired, my save doesn't lose data — I re-auth and it
  completes.
- **In scope:**
  - Confirm the backend contract that makes no-data-loss possible: a save under an expired token
    returns **401 `TOKEN_EXPIRED`** (not a generic 401) so the client knows to re-auth and replay;
    the **working draft is already persisted** (BE-11 autosave), so nothing is lost server-side.
  - Idempotency guard so a replayed save after re-auth doesn't create a duplicate version
    (client sends a `draftRevision`/idempotency key; server no-ops a duplicate).
- **Out of scope:** the frontend interceptor (that's the frontend plan).
- **Tests (e2e):**
  - save with an expired token (FixedClock past exp) → 401 `TOKEN_EXPIRED`; assert the draft row is
    intact and unchanged (E-32).
  - re-auth then replay the save → succeeds, exactly one new version (idempotent, no duplicate).
  - generic expired read still returns `TOKEN_EXPIRED` (consistency with BE-07).
- **Acceptance:** zero data loss across the expiry→re-auth→replay cycle; no duplicate version.
- **Commit:** `feat(auth): expired-session save handling with idempotent replay (no data loss)`

---

### BE-20 — Audit: domain events, event bus, subscribers, audit_log

- **Epic:** Audit (flat, event-subscriber) · **Depends on:** BE-02 · **SRS:** FR-VER-05, AI-SAFE-05, E-39-adjacent
- **Story:** As an admin/compliance reader, security-relevant actions are recorded immutably.
- **In scope:**
  - Adopt `@nestjs/cqrs` EventBus (or a thin in-process dispatcher). `audit_log` migration.
  - Subscribers persist `AuditEntry` for `NoteSaved`, `UserAuthenticated`, `TemplateUpdated`,
    `ProviderDeactivated`. Decoupled — emitters don't know about audit.
  - No PHI in audit metadata (store ids/actions, not note content).
- **Out of scope:** an audit-viewing API (admin can query later if time).
- **Tests:**
  - unit: each subscriber maps its event → correct `AuditEntry` (actor, action, entity).
  - integration: publishing `NoteSaved` writes exactly one audit row; metadata contains no note text
    (PHI check).
  - e2e: a real save produces a `NoteSaved` audit entry.
- **Acceptance:** audited actions recorded; audit contains no PHI.
- **Commit:** `feat(audit): domain-event subscribers persisting an immutable audit log`

---

### BE-21 — Coding: ICD-10 seed + pgvector + semantic search service

- **Epic:** Clinical Coding (flat) · **Depends on:** BE-03 · **SRS:** FR-ICD-04/05, NFR-PERF-02, E-36/E-37
- **Story:** As the system, I hold a local ICD-10 set with embeddings so search needs no external API.
- **In scope:**
  - Enable `vector` extension (migration). `icd10_codes` table (`code` PK, `description`,
    `embedding vector`) + IVFFlat index.
  - Seed **≥200–300** curated ICD-10 codes; precompute embeddings at seed time (embeddings behind a
    port, faked in tests with deterministic vectors).
  - `Icd10SearchService.searchSemantic(query, k)` → cosine-similarity ranked results.
- **Out of scope:** the HTTP endpoint (BE-22).
- **Tests (integration, `pgvector/pgvector` container):**
  - seed loads ≥200 rows idempotently.
  - a symptom query returns the expected code in the top-k (relevance sanity with fixed vectors).
  - query with no strong match → returns ranked best-effort or empty, no error (E-36/E-37).
- **Acceptance:** local semantic search works with no external ICD-10 API.
- **Commit:** `feat(coding): local ICD-10 catalogue with pgvector semantic search`

---

### BE-22 — Coding: ICD-10 search endpoint

- **Epic:** Clinical Coding · **Depends on:** BE-21 · **SRS:** FR-ICD-01/02/03, E-35
- **Story:** As a provider, I search ICD-10 codes in plain English from the workspace.
- **In scope:** `GET /icd10/search?q=` (`@Auth('provider')`), validated query, returns top-k
  `{ code, description, score }`. (Appending to a note is a client action against the existing save
  path — no new write endpoint needed.)
- **Tests (e2e):**
  - valid query → ranked results; empty/blank `q` → 400 (E-35); non-medical `q` → 200 with
    low/empty results, no error (E-37); unauthenticated → 401.
- **Acceptance:** endpoint contract stable and validated.
- **Commit:** `feat(coding): ICD-10 semantic search endpoint`

---

### BE-23 — Template: CRUD + live-read propagation

- **Epic:** Template (flat) · **Depends on:** BE-03 · **SRS:** FR-TMPL-01/02/03/04, E-33/E-34
- **Story:** As an admin, I manage note templates and changes take effect immediately.
- **In scope:**
  - `templates` migration (name, `encounter_type`, `prompt_body`, `is_active`, `created_by`,
    timestamps). Admin CRUD endpoints (`@Auth('admin')`), provider list/select (`@Auth('provider')`).
  - Live propagation is **structural, not push**: `GenerateNoteUseCase` (BE-14) reads the active
    template from RDS at call time, so the next generation automatically uses the latest — verified
    here end-to-end. Deleting a selected template falls back to a default.
- **Out of scope:** any websocket/push mechanism (deliberately not needed).
- **Tests:**
  - integration: CRUD round-trips; only one active template per type (or documented rule).
  - e2e: admin updates the active template → the very next provider generation uses the new
    prompt_body, **no app restart / no refresh** (E-33, using FakeLlmProvider to assert the
    assembled prompt changed); deleting a selected template → generation falls back to default
    (E-34); provider cannot hit admin CRUD → 403.
- **Acceptance:** live propagation demonstrated via a real update→generate sequence.
- **Commit:** `feat(template): template CRUD with live-read propagation into generation`

---

### BE-24 — Admin: encounter oversight + roster management

- **Epic:** Admin · **Depends on:** BE-07, BE-18 · **SRS:** FR-ADMIN-01/02/03, E-38/E-39/E-40
- **Story:** As an admin, I view all encounters and manage the provider roster.
- **In scope:**
  - `GET /admin/encounters?providerId=&from=&to=` (all providers, filterable) `@Auth('admin')`.
  - `POST /admin/providers` (add), `PATCH /admin/providers/:id/deactivate`.
  - Deactivation sets `isActive=false` → BE-07's live check locks the provider out next request;
    their **draft row is preserved** (E-39).
- **Out of scope:** template management (BE-23).
- **Tests:**
  - e2e: admin sees encounters across providers; provider hitting `/admin/*` → 403.
  - e2e: date-range filter — inclusive `from`, exclusive `to`, timezone-safe boundary rows (E-40).
  - e2e: add provider with an existing email → 409 (E-38).
  - e2e/integration: deactivate a provider who has an open draft → their next request 401/403, draft
    row still present in DB (E-39).
- **Acceptance:** filters correct at boundaries; deactivation is lossless for drafts.
- **Commit:** `feat(admin): cross-provider encounter oversight and roster management`

---

### BE-25 — Pioneer: note-version diff endpoint

- **Epic:** Versioning (pioneer #1) · **Depends on:** BE-18 · **SRS:** §Pioneer
- **Story:** As a provider, I see exactly what changed between two note versions.
- **In scope:** `GET /encounters/:id/versions/diff?from=&to=` → structured per-section diff
  (added/removed/changed for S/O/A/P + ICD-10 set delta). Pure function over two `SoapNote`s +
  a thin endpoint. `@Auth('provider')` + ownership.
- **Tests:**
  - unit (diff function): identical versions → empty diff; single-section edit → only that section
    flagged; ICD-10 added/removed reflected in the code-set delta; section cleared → removal.
  - e2e: diff of v1↔v2 returns the expected structure; non-owner → 403; unknown version → 404.
- **Acceptance:** diff is accurate per section and for the ICD-10 set.
- **Commit:** `feat(encounter): structured diff between note versions`

---

### BE-26 — Hardening: rate limiting, security headers, logging, coverage gate, regression

- **Epic:** Cross-cutting · **Depends on:** all · **SRS:** NFR-SEC-05, NFR-OBS-01, E-46
- **Story:** As the owner, I harden the surface and lock in a green regression before submission.
- **In scope:**
  - `@nestjs/throttler` on `POST /auth/login` and `POST /encounters/:id/generate` → 429 on abuse
    (E-46).
  - `helmet`, sensible CORS, body-size limits.
  - Structured logging pass: assert no secret/token/password/PHI ever logged (a test scans a captured
    log buffer during an e2e run).
  - Wire the coverage gate into `test:ci`; run the **full** e2e regression across every prior ticket.
  - `backend/README.md`: run/test/seed instructions + demo credentials.
- **Tests:**
  - e2e: exceed the login rate limit → 429 (E-46); security headers present on responses.
  - meta-test: log buffer during a full happy-path run contains no secret/PHI substrings.
  - `test:ci` green with coverage gates enforced (regression).
- **Acceptance:** rate limits active, no sensitive data in logs, whole suite green under coverage
  gate.
- **Commit:** `chore(core): security hardening, rate limiting, logging audit, coverage gate`

---

## 5. Not in this backend backlog (explicit scope boundary)

Frontend (React SSE client, draft interceptor, UI) and infra (EC2/nginx/RDS/Secrets Manager/TLS,
`AwsSecretsProvider` wiring) are **out of scope here** — they live in their own plans. The backend
exposes the ports (`SecretsProvider`) and contracts (`TOKEN_EXPIRED`, SSE event shapes) those plans
depend on; keep those stable. Deliberately deferred product features: provider style-learning,
bulk PDF export, AI observability dashboard, true cross-device draft restore (single-device is
covered by BE-11).
