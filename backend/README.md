# AI Clinical Scribe — Backend

NestJS 11 API for the Kyron Medical take-home. Transcript/freeform input →
streamed SOAP note with ICD-10 codes.

## Quick start

```bash
# Prerequisites: Node 20+, Docker (for Postgres with pgvector)
cp .env.example .env          # fill in secrets (see Secrets below)
docker compose up -d          # starts pgvector:pg16 on port 5432
pnpm install
pnpm run migration:run        # runs all 9 migrations
pnpm run seed                 # inserts demo users
pnpm run start:dev            # listens on :3000
```

### Demo credentials

| Email | Password | Role |
|---|---|---|
| `dr.alice@demo.clinic` | `DemoPass1!` | PROVIDER |
| `dr.bob@demo.clinic` | `DemoPass2!` | PROVIDER |
| `dr.carol@demo.clinic` | `DemoPass3!` | PROVIDER |
| `admin@demo.clinic` | `AdminPass1!` | ADMIN |

## Secrets

All secrets live in `.env` (local) or AWS Secrets Manager (prod). Never
committed. Required vars:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | HS256 signing key, ≥32 chars |
| `ANTHROPIC_API_KEY` | Claude API key for note generation |
| `CORS_ORIGIN` | Comma-separated allowed origins (default: localhost:5173,3001) |

## Running tests

```bash
# Unit tests (fast, no DB)
pnpm test:unit

# Integration tests (Testcontainers — requires Docker)
pnpm test:int

# End-to-end tests (Testcontainers)
pnpm test:e2e

# All
pnpm test
```

## API overview

### Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | — | Returns JWT. Rate-limited: 5 req/min |
| GET | `/auth/me` | JWT | Current user profile |

### Patients
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/patients` | PROVIDER | Create patient (demo/fictional data only) |
| GET | `/patients` | PROVIDER | List own patients |
| GET | `/patients/:id` | PROVIDER | Get patient |

### Encounters
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/encounters` | PROVIDER | Start encounter |
| GET | `/encounters` | PROVIDER | List own encounters |
| GET | `/encounters/:id` | PROVIDER | Get encounter |
| PATCH | `/encounters/:id/draft` | PROVIDER | Update working draft |
| POST | `/encounters/:id/notes` | PROVIDER | Save versioned note (idempotent via draftRevision) |
| GET | `/encounters/:id/versions` | PROVIDER | List saved versions |
| GET | `/encounters/:id/versions/:n` | PROVIDER | Get specific version |
| GET | `/encounters/:id/versions/diff?from=1&to=2` | PROVIDER | Field-level diff between two versions |
| POST | `/encounters/:id/generate` | PROVIDER | SSE: stream SOAP note generation. Rate-limited: 20 req/min |

### Templates
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/templates` | ADMIN | Create template (inactive by default) |
| GET | `/templates` | PROVIDER/ADMIN | Admin sees all; providers see only active |
| GET | `/templates/:id` | PROVIDER/ADMIN | Get template |
| PUT | `/templates/:id` | ADMIN | Update (use to activate/deactivate) |
| DELETE | `/templates/:id` | ADMIN | Soft-delete (sets isActive=false) |

### Coding
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/coding/icd10/search?q=hypertension` | PROVIDER/ADMIN | Semantic ICD-10 search via pgvector |

### Admin
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/admin/providers` | ADMIN | Create provider account |
| GET | `/admin/providers` | ADMIN | List all providers |
| PATCH | `/admin/providers/:id/deactivate` | ADMIN | Soft-deactivate provider |
| GET | `/admin/encounters` | ADMIN | List all encounters (optional: providerId, from, to) |

## Architecture decisions

**Tiered DDD** — `encounter` and `scribe` use full hexagonal (domain aggregates,
ports, infrastructure adapters). Other contexts (`identity`, `patient`,
`template`, `audit`, `coding`) are flat NestJS convention — the complexity
doesn't justify the indirection.

**SSE over WebSocket** — note generation is one-directional (server → client),
SSE is simpler to proxy and doesn't need a WS handshake.

**Append-only versioning** — `note_versions` rows are immutable; a new row per
save. Idempotency via `draft_revision` unique partial index prevents double-saves
on retry.

**Live template propagation** — `GenerateNoteUseCase` reads the active template
from DB on every call (no in-process cache). A template change takes effect on
the next generation without a restart.

**Expired-session replay** — saving a note with an expired token returns
`TOKEN_EXPIRED` (not 401). The frontend can re-authenticate and replay the
identical request with the same `draftRevision` — the idempotency key prevents
a duplicate version.

**pgvector for ICD-10 search** — 70k+ codes with pre-computed 1536-dim
embeddings, IVFFLAT index, cosine similarity. Semantic search beats substring
matching for clinical terminology.

**Security hardening** — helmet (security headers), CORS (configurable origin
allow-list), rate limiting via `@nestjs/throttler` (5/min login, 20/min
generate, 100/min global), body size capped at 2 MB.
