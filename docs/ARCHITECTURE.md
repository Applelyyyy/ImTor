# Architecture

## Components and data boundaries

```text
Browser ─ HTTPS ─ Caddy / existing proxy ─ Next.js App Router
                                          ├ public server-rendered pages
                                          ├ guarded merchant/admin pages
                                          ├ same-origin REST Route Handlers
                                          ├ NextAuth v4 Google callback/session
                                          └ shared domain services ─ Prisma ─ PostgreSQL
Browser ─ short-lived presigned PUT ─ private S3 staging
Next.js ─ fetch, inspect, Sharp re-encode ─ new immutable approved S3 key
Browser ─ GET approved image ─ configured public image domain
```

One repository and one application deployment; no independently deployed frontend/backend. Server-rendered reads use query DTOs rather than exposing database users/accounts wholesale. The database is authoritative for role, suspension, store membership, stock, reservations and schedule time. UI visibility is not authorization. Next.js layouts and child server components can render concurrently: a layout redirect alone is not a data-access boundary. Each protected admin page must authenticate/authorize before its own database query; mutation APIs and services independently enforce the same permissions. Regression tests inspect raw unauthenticated response bytes as well as the eventual browser redirect.

## Source boundaries

- `src/app`: public routes, guarded management pages and `api` Route Handlers.
- `src/components`: reusable accessible UI and client interactions; no credentials.
- `src/lib`: Prisma adapter, session/auth guards, validators, permission checks, read/query projections.
- `src/services`: schedule generation/status, price evaluation, transactional reservations and attendance, image lifecycle and demo lineage.
- `prisma/schema.prisma` and migrations: persisted model and database invariants.
- `scripts`: explicit migration/seed and operational lifecycle utilities.

`MarketScheduleService` evaluates venue-local dates; `PricingService` computes price in integer minor units at an authoritative instant. Reservations snapshot price and adjust inventory in the same transaction. Stall assignment must reject time overlap, including different sessions. Admin changes are audited. Demo batches carry lineage and are never counted as genuine social impact.

## Authentication

Stable NextAuth v4.24.15 with `@next-auth/prisma-adapter`, database-backed sessions and Google OAuth. `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` are application names explicitly passed to the v4 configuration. `NEXTAUTH_URL` is the canonical external URL. Real-user guards reject suspended/demo identities; admin permissions are checked from database state, not browser claims. `ADMIN_EMAILS` grants bootstrap privileges only on authenticated sign-in; protect and minimize the allowlist.

## Infrastructure and operations

Production image is Next.js standalone on Node 24 with UID 1000 (`node`), no Prisma CLI in runtime. A separate migration image contains Prisma/TypeScript tooling. PostgreSQL has a named volume and no published host port; Compose uses `service_healthy` then `service_completed_successfully` ordering. Caddy is opt-in and persists TLS state. Existing proxies can use loopback without port 80/443 conflicts.

Uploads are not local container files; backups of PostgreSQL do not back up S3 objects. Application containers are replaceable, named volumes and external images are not. Single-VM availability and in-process request handling are intentional MVP trade-offs; monitor health/disk, test restore and store encrypted off-VM backups. Database-backed rate limits are needed across app instances; no claim of multi-region failover.

## Security and performance review points

Validate all writes and same-origin mutation requests; recheck ownership at the service boundary. Never accept client-provided role, approved image key, price snapshot, stock result or verification badge. Avoid logging OAuth tokens/presigned URLs. Bound uploads, calendar horizons and query results; index feed/history lookups. Use real payment/food-safety verification only if implemented separately. A listing is not a certification of food safety.

See [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) and [Compose dependency conditions](https://docs.docker.com/compose/how-tos/startup-order/).
