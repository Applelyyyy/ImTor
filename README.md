# ImTor · อิ่มต่อ

**Discover More. Spend Less. Waste Less.** A Thai-first campus marketplace, configurable market calendar, accessible stall locator, and optional food rescue/reservation workflow. Regular full-price products are first-class listings; a listing is not automatically a rescued meal.

One Next.js App Router application serves public pages, merchant/admin tools, REST APIs and Google authentication. PostgreSQL persists business data. Product images use external S3-compatible storage. No separate backend, managed database, payment processor, Redis or paid map service is required.

## Stack

Node.js 24 LTS · Bun 1.4.3 · Next.js 16.4.3 / React 19 · TypeScript · Tailwind/shadcn · Prisma 7.10.1 · PostgreSQL 18 · NextAuth 4.24.15 · AWS SDK v3 / Sharp · Vitest / Playwright. Stable NextAuth v4 is used deliberately, not the Auth.js v5 beta; application `AUTH_*` names are explicitly mapped to v4 options.

## Local development

Prerequisites: Node 24, Bun and Docker Compose v2+ (Compose `!reset` is not required).

```bash
cp .env.example .env
chmod 600 .env
# Replace AUTH_SECRET (generate: openssl rand -hex 32).
# Configure Google/S3 only when exercising those integrations.
bun install --frozen-lockfile
IMTOR_ENV_FILE=.env docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d --wait db
bun run db:generate
bun run db:migrate
bun run dev
```

Open [localhost:3000](http://localhost:3000). `.env.example` uses database `localhost:55432` for a host-run application; PostgreSQL is bound to loopback only in the explicit development override. For **all-container development**, change `DATABASE_URL` host/port to `db:5432` and run:

```bash
IMTOR_ENV_FILE=.env docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up --build app
```

The app starts only after PostgreSQL is healthy and migrations succeed. Source and public assets are mounted in development. Container startup regenerates the Prisma client into the source bind mount before starting Next.js, so the all-container path does not rely on a preexisting host-generated client. For a host-run application, rerun `bun run db:generate` after schema changes. Use Compose Watch (`up --watch app`) or rebuild after dependency/schema changes. Never use the development override on a public VM.

### Optional fictional demo records

On an isolated local database only, set `DEMO_MODE=true` and `ENABLE_DEMO_GENERATOR=true`, then run `bun run db:seed`. The CLI explicitly generates labelled fictional records. It does **not** create a password, magic demo login, public admin account or real Google identity. Browse without login; sign in with your real configured Google account for mutations. `ADMIN_EMAILS` is a comma-separated, server-only bootstrap allowlist; leave it empty unless an operator is intentionally granting admin access. Both demo flags default to false; production scripts reject demo-enabled configuration.

## Verification

```bash
bun run lint
bun run typecheck
bun run test:unit
# Requires TEST_DATABASE_URL ending in _test on localhost/db; see database docs:
bun run test:integration
bun run build
# Browser test prerequisites: app on localhost:3100 with matching APP_URL/NEXTAUTH_URL,
# seeded demo records, and configured real S3-compatible test storage. No login bypass exists.
bun x tsx scripts/test-fixtures.ts
bun run test:e2e
codex-browser-env uv tool run --from playwright python tests/e2e/security.py
codex-browser-env uv tool run --from playwright python tests/e2e/admin.py
bun x tsx scripts/test-fixtures.ts cleanup
# Config validation, no startup and no deployment:
IMTOR_ENV_FILE=.env.example docker compose --env-file .env.example -f compose.yaml config --quiet
for script in scripts/*.sh; do bash -n "$script"; done
```

The production command `bun run build` generates Prisma then compiles Next.js standalone output. Container runtime uses `node server.js`, not Bun or `next start`. Unit tests do not need a running database. Integration tests require an explicitly configured `TEST_DATABASE_URL` pointing to a distinct local database whose name ends in `_test` (for example `imtor_test`); see [test database setup](docs/DATABASE.md#isolated-integration-test-setup). Database tests must never target a production database. See the repository's verification report for actual observed results; commands in this README are not claims of a tested public deployment.

## Self-hosting

Copy `.env.production.example` to `.env.production`, replace every placeholder and store with mode `600`. Select exactly one proxy mode:

```bash
# Existing host proxy/tunnel, app bound to 127.0.0.1:3000, no 80/443 conflicts:
IMTOR_ENV_FILE=.env.production COMPOSE_MODE=external ./scripts/deploy.sh
# OR bundled Caddy (only if DNS and ports 80/443 are yours to configure):
IMTOR_ENV_FILE=.env.production COMPOSE_MODE=caddy ./scripts/deploy.sh
```

Deployment scripts mutate only the selected ImTor Compose project. Do not run them against an existing production installation without authorization and an upgrade review. PostgreSQL has no production host port; database and Caddy certificate volumes persist through updates. Public DNS, certificates, Google OAuth and external S3 require operator configuration and are not implicitly verified by a successful local build.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md)
- [Market scheduling](docs/MARKET_SCHEDULING.md) · [Stall locations](docs/STALL_LOCATIONS.md) · [User flow](docs/USER_FLOW.md)
- [Deployment](docs/DEPLOYMENT.md) · [Google OAuth](docs/GOOGLE_OAUTH.md) · [S3 / R2 setup](docs/S3_SETUP.md)
- [Backup and restore](docs/BACKUP_RESTORE.md) · [Interview demo](docs/INTERVIEW_DEMO.md)
- [Original product requirements](docs/PRODUCT_SPEC.md)

### Running browser tests outside Codex

The supplied `test:e2e` command uses this Codex machine's isolated Playwright environment. On another development machine, install Python Playwright in a virtual environment, run `python -m playwright install chromium` (install Chromium system libraries for your OS), and invoke `python tests/e2e/browser.py`, `python tests/e2e/security.py`, and `python tests/e2e/admin.py` directly. Start the app on port 3100 with matching APP_URL/NEXTAUTH_URL; configure local S3-compatible storage before the upload scenario. Run `bun x tsx scripts/test-fixtures.ts` first and its `cleanup` command afterward. Fixture creation refuses a production process or a non-loopback database; it creates opaque test sessions outside the application, not a runtime login bypass.
