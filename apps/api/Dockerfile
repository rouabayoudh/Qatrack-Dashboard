# ──────────────────────────────────────────────
# Stage 1: Builder (Shared base for all packages)
# ──────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g turbo@2

# ──────────────────────────────────────────────
# Stage 2: Prune the monorepo (isolate api workspace)
# ──────────────────────────────────────────────
FROM base AS pruner
COPY . .
RUN turbo prune api --docker

# ──────────────────────────────────────────────
# Stage 3: Install dependencies (cached layer)
# ──────────────────────────────────────────────
FROM base AS installer
WORKDIR /app
# Copy lockfiles and package manifests from pruned output
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

# ──────────────────────────────────────────────
# Stage 4: Build the API
# ──────────────────────────────────────────────
FROM installer AS builder
WORKDIR /app
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=api...

# ──────────────────────────────────────────────
# Stage 5: Production runner (minimal image)
# ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Only copy production deps + built output
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3001

CMD ["node", "dist/main"]
