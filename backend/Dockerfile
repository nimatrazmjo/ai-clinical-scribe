# syntax=docker/dockerfile:1
# ---- deps: install all dependencies (including devDeps for TypeScript build) ----
FROM node:22-alpine AS deps
WORKDIR /app

# Native build tools (needed by argon2)
RUN apk add --no-cache python3 make g++

# Pin exact pnpm version matching the lockfile / packageManager field
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store-backend,target=/root/.local/share/pnpm/store \
    echo "network-timeout=300000" > .npmrc && \
    pnpm install --frozen-lockfile

# ---- builder: compile TypeScript → dist/ ----
FROM deps AS builder
COPY . .
RUN pnpm run build

# ---- development: hot-reload with source mounted at runtime ----
FROM deps AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]

# ---- production: copy prebuilt artifacts, no re-download ----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# argon2 native addon needs libstdc++ at runtime
RUN apk add --no-cache libstdc++

# Health-check via wget (busybox, already in alpine)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null http://localhost:3000/health || exit 1

COPY --from=builder /app/dist ./dist
# Copy node_modules from deps stage — avoids a second network round-trip
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000
CMD ["node", "dist/main"]
