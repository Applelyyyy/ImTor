# Self-hosted deployment

For the current `imtor.applely.dev` existing-Cloudflare-Tunnel setup on **port 3100**, use [SELF_HOSTED_DEPLOYMENT.md](SELF_HOSTED_DEPLOYMENT.md) and [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md). The Caddy/host-proxy modes below remain alternatives; do not combine them with Tunnel mode.

## Prerequisites and authorization

A Linux VM with Docker Engine/Compose, sufficient free disk/RAM for a Next.js build, secure SSH, a backup destination and an operator-controlled domain. Review VM port usage before choosing a proxy. Discovery of existing containers/proxies is read-only: do not stop, delete or reconfigure unrelated services. These instructions are a runbook, not evidence that DNS, TLS, OAuth or S3 have been exercised.

## Configuration

```bash
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32  # paste into AUTH_SECRET; do not log/share the resulting secret
```

Replace all placeholders. `POSTGRES_PASSWORD` and the URL-encoded password in `DATABASE_URL` must agree. Use `db:5432` inside Compose. `APP_URL` and `NEXTAUTH_URL` must be identical external HTTPS origins. `APP_DOMAIN` is a bare hostname, without scheme or path. `ADMIN_EMAILS` should contain only intentional bootstrap administrators. Keep both demo flags false. Server environment values are not `NEXT_PUBLIC_*` and must not enter browser bundles. Avoid `docker compose config` without `--quiet`: it can print secrets.

| Values | Requirement |
|---|---|
| `DATABASE_URL`, `POSTGRES_DB/USER/PASSWORD` | Required for database/app/migrations; private container hostname |
| `AUTH_SECRET` | Random >=32-character secret; explicit NextAuth v4 option |
| `AUTH_GOOGLE_ID/SECRET` | Required for Google sign-in; explicitly mapped provider options |
| `APP_URL`, `NEXTAUTH_URL` | Matching public HTTPS origin; localhost HTTP only for development |
| `APP_DOMAIN`, `ACME_EMAIL` | Required for bundled public Caddy/TLS |
| `ADMIN_EMAILS` | Optional comma-separated server bootstrap allowlist |
| `S3_*` | Required for image uploads; see S3 setup; browsing existing images is independent |
| `DEMO_MODE`, `ENABLE_DEMO_GENERATOR` | False in production; both gates required for local fictional generation |
| `BACKUP_DIRECTORY`, `BACKUP_RETENTION_DAYS` | Secure directory, positive integer retention; defaults `./backups`, 14 |
| `TZ` | Container default; venue's persisted timezone still controls market rules |
| `APP_BIND_ADDRESS`, `APP_PORT` | Existing host-proxy mode; default `127.0.0.1:3000` |

### Production with bundled Caddy

Configure A/AAAA records for your actual domain to the VM. Only publish an AAAA record if IPv6 genuinely routes to it. Permit inbound TCP 80/443 for ACME/HTTPS; UDP 443 is optional HTTP/3. Do not use a domain or IP from example documentation as your own. Configure Google callback before sign-in.

```bash
export IMTOR_ENV_FILE=.env.production COMPOSE_MODE=caddy
./scripts/deploy.sh
```

Caddy obtains certificates and redirects HTTP to HTTPS; named `caddy_data`/`caddy_config` volumes persist state. Certificate issuance needs reachable DNS/ports and is not proven by local Caddy syntax validation. The admin API stays inside the container; no host port 2019 is published.

### Existing proxy / tunnel (no conflicting 80/443)

```bash
export IMTOR_ENV_FILE=.env.production COMPOSE_MODE=external
./scripts/deploy.sh
```

This combines `compose.yaml` with `compose.external-proxy.yaml`, leaves bundled Caddy inactive, and binds the app to loopback only. Point an existing **host** proxy/tunnel to `http://127.0.0.1:3000`. A proxy running in another container cannot use its own localhost to reach ImTor: deliberately attach both to a dedicated private Docker network and route to `app:3000` with no published port, or explicitly configure host-gateway routing/firewall. Do not casually bind `0.0.0.0` or expose app/database ports to the Internet.

At the TLS edge, preserve the intended Host and set trusted `X-Forwarded-Proto: https`, `X-Forwarded-Host` and sanitized forwarded-client headers. Overwrite untrusted incoming values. Keep direct app access restricted. `NEXTAUTH_URL` is the public HTTPS URL, never `http://app:3000`. Do not enable Auth.js v5 `AUTH_TRUST_HOST` as a substitute for the actual v4 configuration.

### Direct Compose equivalent

```bash
export IMTOR_ENV_FILE=.env.production
# Add --profile edge for bundled Caddy, or -f compose.external-proxy.yaml for existing proxy.
docker compose --env-file .env.production -f compose.yaml config --quiet
docker compose --env-file .env.production -f compose.yaml --profile edge up -d --build
```

The project name is `imtor`. For a second isolated instance, use a distinct Compose `--project-name` (scripts: `IMTOR_PROJECT_NAME`) and different host ports/env file. Never accidentally point a test instance to production's database URL or object namespace.

## Startup, persistence and health

`db` healthy → `migrate` (`prisma migrate deploy`) exit 0 → `app` healthy (`GET /api/health`) → Caddy. Migration failure prevents application startup. Migration image contains CLI dependencies; production app is Node standalone with a non-root user, dropped capabilities and no migration tooling. The base configuration publishes no database port. Explicit dev override alone publishes PostgreSQL at `127.0.0.1:55432`.

PostgreSQL 18 uses `/var/lib/postgresql` in its named volume. Recreating app/migration containers does not delete data. No normal deployment/update command removes volumes. JSON logs are rotated (10 MB × 3 per service). Do not print secrets or upload signed URLs in logs.

```bash
IMTOR_ENV_FILE=.env.production ./scripts/healthcheck.sh
# Same env/project/files as deployment:
IMTOR_ENV_FILE=.env.production docker compose --env-file .env.production -f compose.yaml ps
IMTOR_ENV_FILE=.env.production docker compose --env-file .env.production -f compose.yaml logs --tail=100 app migrate db
```

Internal health verifies the application/database path, not public DNS, certificates, Google, S3 or every business flow. Check the public `/api/health` separately from an external client after authorized deployment. Monitor disk, backup age, health failures and certificate expiry.

## Updates and recovery

Review code/migration SQL; run tests before updating. Use expand/contract migrations compatible with the currently running app because migrations run before replacement. Destructive schema changes need an explicit maintenance/rollback plan.

```bash
IMTOR_ENV_FILE=.env.production COMPOSE_MODE=external ./scripts/update.sh
```

Order: validate config → build images → verify running database → custom-format verified backup → migration → recreate app → health. Failed build/backup/migration stops the sequence. A health failure is reported, not disguised as success; inspect logs and do not automatically restore over production. The update script neither pulls/reset Git nor upgrades PostgreSQL, prunes Docker or runs `down -v`.

For binary rollback, use a reviewed prior `IMAGE_TAG`/image (retain immutable release tags) with compatible schema. A database restore is a separate destructive operation requiring maintenance, a verified archive and explicit confirmation. See [backup/restore](BACKUP_RESTORE.md). Back up TLS state and encrypted environment secrets separately; S3 needs its own retention/versioning strategy.

## Validation without deployment

```bash
IMTOR_ENV_FILE=.env.example docker compose --env-file .env.example -f compose.yaml config --quiet
IMTOR_ENV_FILE=.env.example docker compose --env-file .env.example -f compose.yaml -f compose.dev.yaml config --quiet
IMTOR_ENV_FILE=.env.example docker compose --env-file .env.example -f compose.yaml -f compose.external-proxy.yaml config --quiet
for script in scripts/*.sh; do bash -n "$script"; done
docker build --target runtime -t imtor-app:local .
docker build --target migration -t imtor-migration:local .
```

Image tags are pinned for repeatability; review upstream security updates and rebuild regularly. The public non-secret `S3_PUBLIC_BASE_URL` is passed as a build argument to configure the Next.js image-origin allowlist. Rebuild the app image whenever this origin changes; runtime environment alone does not update a compiled image allowlist. No credential is required or copied during image build. Never pass production secrets as Docker build arguments. See [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying) and [Docker Compose readiness](https://docs.docker.com/compose/how-tos/startup-order/).

## Restricted-network Prisma engine download

The default build uses the official `https://binaries.prisma.sh` engine source. If that CDN is unreachable in your network, `Dockerfile` accepts the non-secret `PRISMA_ENGINES_MIRROR` build argument. A mirror is a supply-chain trust decision: first compare the exact engine archive's SHA-256 to the checksum independently fetched from the official source, and confirm the engine version/commit expected by the locked Prisma package. Do not replace the engine with a dummy executable or silently skip migration checks.

```bash
# Network-specific fallback only, after independently validating the required archive:
docker build --build-arg PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma \
  --target migration -t imtor-migration:local .
```

The checked-in production default remains the official source. No host `/tmp` engine path is baked into an image. Use a reviewed local Compose override for build arguments if the same fallback is required during deployment.
