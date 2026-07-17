# Build context: monorepo root (needed for packages/contracts/src via @contracts alias)
#
# Targets:
#   deps        — install npm deps (cached layer)
#   builder     — tsc + vite build → dist/
#   development — vite dev server with hot-reload (source mounted at runtime)
#   production  — nginx serving dist/ with SPA fallback + /api proxy

# ---- deps: install frontend npm dependencies --------------------------------
FROM node:22-alpine AS deps
WORKDIR /app/frontend

RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile TypeScript + vite bundle -----------------------------
FROM deps AS builder

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# contracts source must exist before tsc resolves the @contracts alias
COPY packages/contracts/src /app/packages/contracts/src
COPY frontend/ ./

RUN pnpm run build

# ---- development: vite dev server ------------------------------------------
FROM deps AS development

COPY packages/contracts/src /app/packages/contracts/src
COPY frontend/ ./

ENV NODE_ENV=development
EXPOSE 5173

# --host binds to 0.0.0.0 so Docker port mapping works
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---- production: nginx static + reverse proxy --------------------------------
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://localhost/ || exit 1
