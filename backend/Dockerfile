# ---- deps: install all dependencies (including devDeps for TypeScript build) ----
FROM node:20-alpine AS deps
WORKDIR /app

# Enable pnpm via corepack (ships with Node 20)
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

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

# ---- production: minimal runtime image ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

# Health-check via wget (busybox, already in alpine)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null http://localhost:3000/health || exit 1

COPY --from=builder /app/dist ./dist
COPY package.json pnpm-lock.yaml ./
# Production deps only — shaves ~200 MB off the image
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

EXPOSE 3000
CMD ["node", "dist/main"]
