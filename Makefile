# Dev workflow — no rebuilds needed when editing source
#
#   make dev        start everything with hot-reload
#   make stop       stop all containers
#   make prod       build + run the production stack (nginx + compiled API)
#   make seed       seed demo users into the running DB

.PHONY: dev stop prod seed

# Hot-reload dev:
#   • postgres + NestJS (nest start --watch, source mounted) in Docker
#   • Vite dev server on the host — edits reflect immediately, no container involved
dev:
	@echo "Starting backend + DB in Docker (hot-reload)…"
	docker compose --profile dev up -d postgres api-dev
	@echo "Starting Vite dev server on host…"
	cd frontend && pnpm dev

stop:
	docker compose --profile dev down

# Production stack — full rebuild only needed when you want to verify the
# production image (nginx-served frontend, compiled NestJS). Not for daily dev.
prod:
	docker compose up --build

seed:
	cd backend && \
	DATABASE_URL="postgres://scribe:$$(grep POSTGRES_PASSWORD ../.env | cut -d= -f2)@localhost:5432/clinical_scribe" \
	pnpm run seed
