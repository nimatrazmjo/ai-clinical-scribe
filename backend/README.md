# AI Clinical Scribe — Backend

NestJS API for the Kyron Medical take-home challenge. Tiered DDD modular monolith; hexagonal
internals for `encounter` and `scribe` contexts, flat Nest convention everywhere else.

## Prerequisites

- Node 22+
- pnpm 9+
- Docker (for local Postgres and Testcontainers)
- A running Postgres instance **or** `docker compose up db` from the repo root

## Setup

```bash
pnpm install --ignore-scripts
cp .env.example .env          # fill in DATABASE_URL
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/dbname` |
| `JWT_SECRET` | yes (auth) | random 32-byte hex string |
| `PORT` | no | defaults to 3000 |

## Run

```bash
# development (watch mode)
pnpm start:dev

# production build
pnpm build && node dist/main
```

## Database migrations + seed

```bash
# run migrations against DATABASE_URL
pnpm typeorm migration:run

# seed demo users (idempotent — safe to run multiple times)
DATABASE_URL=<your-url> pnpm seed
```

## Demo credentials

Fictional accounts seeded by `pnpm seed`. **Never substitute real credentials.**

| Email | Password | Role |
|---|---|---|
| `dr.alice@demo.clinic` | `DemoPass1!` | provider |
| `dr.bob@demo.clinic` | `DemoPass2!` | provider |
| `dr.carol@demo.clinic` | `DemoPass3!` | provider |
| `admin@demo.clinic` | `AdminPass1!` | admin |

## Tests

```bash
# unit only (no Docker needed)
pnpm test:unit

# integration (starts Postgres via Testcontainers — requires Docker)
pnpm test:int

# e2e
pnpm test:e2e

# full suite with coverage
pnpm test:ci
```

Coverage gate: 80% lines/branches/functions/statements globally.

## Health check

```
GET /health
→ { "status": "ok", "db": "up" }
```

`db` reports `"down"` if Postgres is unreachable; the endpoint itself always returns 200.
