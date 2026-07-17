# ---- deps: install all dependencies (needed to compile TypeScript) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile TypeScript → dist/ ----
FROM deps AS builder
COPY . .
RUN npm run build

# ---- development: hot-reload with source mounted at runtime ----
FROM deps AS development
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- production: minimal runtime image ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Health-check uses wget (busybox, already in alpine)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health | grep -q '"status"' || exit 1

COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
# Production deps only — shaves ~200 MB off the image
RUN npm ci --omit=dev && npm cache clean --force

EXPOSE 3000
CMD ["node", "dist/main"]
