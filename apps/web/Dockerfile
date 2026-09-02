# ──────────────────────────────────────────────
# Stage 1: Base
# ──────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g turbo@2

# ──────────────────────────────────────────────
# Stage 2: Prune the monorepo (isolate web workspace)
# ──────────────────────────────────────────────
FROM base AS pruner
COPY . .
RUN turbo prune web --docker

# ──────────────────────────────────────────────
# Stage 3: Install dependencies
# ──────────────────────────────────────────────
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

# ──────────────────────────────────────────────
# Stage 4: Build Next.js app
# ──────────────────────────────────────────────
FROM installer AS builder
WORKDIR /app
COPY --from=pruner /app/out/full/ .

# Build-time env: Next.js needs the API URL at build time for server components
ARG NEXT_PUBLIC_API_URL=http://api:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN turbo run build --filter=web...

# ──────────────────────────────────────────────
# Stage 5: Production runner (Next.js standalone)
# ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
