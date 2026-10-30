# syntax=docker/dockerfile:1.7
FROM oven/bun:1.4.3 AS bun
FROM node:24.22.0-bookworm-slim AS base
WORKDIR /app
LABEL org.opencontainers.image.title="ImTor" org.opencontainers.image.description="Self-hosted campus marketplace"
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update && apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

FROM base AS dependencies
ARG PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ENV PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

FROM dependencies AS development
COPY . .
RUN bun run db:generate
EXPOSE 3000
CMD ["bun", "run", "dev"]

# Keep the Prisma CLI and TypeScript runner out of the standalone runtime.
FROM dependencies AS migration
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN bun run db:generate
USER node
CMD ["bun", "run", "db:migrate"]

FROM dependencies AS builder
ARG S3_PUBLIC_BASE_URL
ENV S3_PUBLIC_BASE_URL=$S3_PUBLIC_BASE_URL
COPY . .
# Build-only non-secret URL: no database is contacted by prisma generate.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN bun run build

FROM node:24.22.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
LABEL org.opencontainers.image.title="ImTor" org.opencontainers.image.description="Standalone Next.js runtime"
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
