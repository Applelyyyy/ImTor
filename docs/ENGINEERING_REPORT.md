# ImTor 2.0 — Engineering report

Date: 2026-10-30. Scope: the supplied PRODUCT_SPEC.md. This report distinguishes implemented behavior, observed local verification, and infrastructure-dependent checks.

## 1. Features implemented

Thai-first guest marketplace, search/categories/availability/discount/rescue filters, product and store pages, configurable market venues, week calendar, session-aware vendor discovery, SVG/marker stall maps with text alternatives, merchant shop/product/photo/attendance workflows, scheduled prices, optional inventory-backed pickup reservations, Google authentication integration, administrative moderation/editors/settings/reports, fictional demo generation and genuine-only impact reporting. Ordinary full-price listings have no rescue or discount badge.

## 2. Repository architecture

One Git repository and one full-stack Next.js App Router application. `src/app` contains server-rendered pages and Route Handlers; `src/components` contains interactive leaves and shadcn components; `src/lib` contains database/session/permission/validation/query boundaries; `src/services` owns scheduling, pricing, attendance, stock, reservations, uploads and demo batches. There is no separate backend deployment, Redis, paid map dependency or required managed database.

## 3. Application routes

Public: `/`, `/explore`, `/markets`, `/markets/[slug]`, `/markets/[slug]/map`, `/store/[slug]`, `/product/[id]`, `/login`, `/become-vendor`.

Authenticated: `/profile`, `/reservations`, `/merchant`, `/merchant/products`, `/merchant/products/new`, `/merchant/products/[id]/edit`, `/merchant/schedule`, `/merchant/locations`, `/merchant/reservations`, `/merchant/settings`.

Admin: `/admin`, `/admin/users`, `/admin/stores`, `/admin/products`, `/admin/markets`, `/admin/markets/[id]/schedule`, `/admin/markets/[id]/layout`, `/admin/stalls`, `/admin/attendance`, `/admin/reservations`, `/admin/analytics`, `/admin/demo-generator`, `/admin/settings`, `/admin/audit-logs`, `/admin/reports`.

## 4. API routes

REST resources are dispatched inside `/api/[...path]`; Google/session/CSRF endpoints use `/api/auth/[...nextauth]`. Health is `/api/health` and checks PostgreSQL.

Resources include `/api/products`, `/api/stores`, `/api/profile`, `/api/markets`, `/api/attendance`, `/api/templates`, `/api/reservations`, `/api/uploads`, `/api/reports` and their documented item/mutation paths. Product operations include duplicate, discount creation/removal and admin-only simulated-time pricing preview. Admin resources include users, stores, products, venues, weekly rules, date exceptions, zones, normalized stalls, sessions, attendance verification, settings, reports, audit logs, demo generation/cleanup and bounded expiration. All mutations check origin, authenticated database identity, authorization and validated input. Responses consistently contain `data` or `error.message`.

## 5. Database models

Prisma/PostgreSQL: User, Account, Session, VerificationToken; Store, StoreMember, AttendanceTemplate; MarketVenue, MarketZone, MarketStall, MarketScheduleRule, MarketScheduleException, MarketSession, StoreAttendance, StallAssignment; ProductCategory, Product, DiscountRule, Reservation, InventoryMovement; SystemSetting, Report, AuditLog, DemoBatch, Upload, RateLimit.

Small value objects are intentionally columns rather than extra one-to-one tables: permanent store location and verification, product image, and pickup code. Seven genuine categories are installed by migration independently of demo data. PostgreSQL constraints reject negative money/stock, invalid intervals, out-of-range map markers, cross-market zones and overlapping assignments. Reservation price and product-mode snapshots preserve transaction and impact history.

## 6. Market scheduling

`MarketScheduleService` converts venue-local dates/hours to UTC timestamps. Weekly and biweekly rules use an explicit Monday anchor. Closures, one-off hours, previous-day overnight sessions, timezone boundaries and cancellation are supported. One session per venue/local date is a deliberate MVP limit. Materialization locks each venue before reading rules; admin edits use the same venue lock. Cancelled instances are never silently revived.

Populated active sessions must be cancelled before changing their recurrence. Cancellation preserves historical rows and releases eligible stock/assignments; future unpopulated sessions can be rebuilt. Same-date re-opening and seller reassignment are explicit actions, not silent relocation.

## 7. Stall locations

Venues own zones and stalls. Maps use persisted normalized x/y coordinates, an optional validated layout image, session selection, stall highlighting and a keyboard-accessible textual list. Admins can edit numeric marker positions without a GIS dependency. Self-reported claims require an authorization affirmation and do not imply physical vacancy or official verification. PostgreSQL range exclusion prevents overlapping use even across different sessions. Demo venues deliberately have no fabricated navigation coordinates. Google Maps links target only configured venue/entrance coordinates, never an invented precise internal-stall route.

## 8. Merchant experience

One Google account may browse and own a shop. Shop creation is immediate unless the admin enables approval. Product posting initially shows photo, name and baht price; advanced settings are disclosed separately. Browse-only is the default and does not invent stock. Merchants can edit/publish/archive/duplicate listings, configure discounts, choose session/stall, confirm actual opening, cancel attendance, save preferred attendance templates and manage pickup reservations. Templates do not silently allocate future stalls.

## 9. Discount engine

`PricingService` uses integer satang and deterministic rule precedence. FIXED, PERCENT_OFF and FINAL_PERCENT are distinct: 30% of a ฿100 base produces ฿30 and a 70% discount. Absolute activation/expiration and daily repeating cross-midnight windows use server time. Equal repeating boundaries are rejected before persistence. Fixed defaults above a cheap product's base are ignored rather than increasing its price or breaking the feed. No cron determines the current price; reservation creation snapshots it transactionally.

## 10. Google OAuth

Stable NextAuth.js 4.24.15 (the Auth.js project) was selected instead of the v5 beta. The Prisma adapter persists Google-linked accounts and opaque database sessions. Verified email, suspension, and rejection of fictional demo identities are checked server-side. Administrators are bootstrapped through trusted server-only `ADMIN_EMAILS`; clients cannot grant roles, and the final active super-admin is protected.

The isolated adapter/session path was tested. **A real Google authorization/callback was not tested:** OAuth client credentials were not supplied. See GOOGLE_OAUTH.md.

## 11. S3 integration

AWS SDK v3 issues short-lived direct-PUT URLs to private staging keys. Finalization checks ownership, length and object ETag, bounds the body, decodes allowed raster formats with Sharp, re-encodes JPEG and writes a new immutable approved key. Reusing a staging URL cannot overwrite the approved bytes. Public access must be limited to `approved/`; this policy is an operator requirement, not automatically guaranteed by a bucket hostname.

The browser-to-S3-compatible RustFS upload and anonymous approved-image retrieval passed locally. **External R2/AWS credentials, provider CORS, media DNS and remote policy were not verified.** The public media origin is an explicit nonsecret build argument for Next image allowlisting. It requires a rebuild when changed. Loopback image fetching is permitted only by the development configuration.

## 12. Docker Compose

`app`: standalone non-root Node 24 runtime. `db`: private PostgreSQL 18 with persistent volume. `migrate`: one-off real Prisma migration image. `caddy`: optional edge profile with persistent TLS/config volumes. The app waits for database health and migration success. Compose includes restart policies, bounded logs, dropped app capabilities and no-new-privileges. Development and existing-proxy overrides are supplied; no existing host proxy was modified.

## 13. Environment variables

Examples: `.env.example` and `.env.production.example`. Mandatory for core operation: DATABASE_URL, POSTGRES_DB/USER/PASSWORD, AUTH_SECRET, APP_URL, NEXTAUTH_URL. Google requires AUTH_GOOGLE_ID/SECRET; trusted bootstrap uses ADMIN_EMAILS. S3 uses S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY/PUBLIC_BASE_URL and optional S3_FORCE_PATH_STYLE. Also APP_DOMAIN, ACME_EMAIL, TZ, DEMO_MODE, ENABLE_DEMO_GENERATOR, backup location/retention, COMPOSE_MODE and optional isolated TEST_DATABASE_URL. Secrets never use NEXT_PUBLIC variables or Docker build arguments.

## 14. Local development

```bash
cp .env.example .env
# Generate private secrets and configure the local database/storage/OAuth values.
bun install --frozen-lockfile
bun run db:generate
bun run db:migrate
bun run dev
```

For the local session, the development app was verified on port 3100. Demo seeding is explicit and gated; it creates only fictional suspended users, never a login bypass. Integration tests require a separate local database ending in `_test`; Vitest selects TEST_DATABASE_URL when configured. See README.md for full setup.

## 15. Production commands

```bash
cp .env.production.example .env.production
# Fill real values; keep this file private.
IMTOR_ENV_FILE=.env.production COMPOSE_MODE=external ./scripts/deploy.sh
# Subsequent releases:
IMTOR_ENV_FILE=.env.production COMPOSE_MODE=external ./scripts/update.sh
```

These are operator instructions, not a claim that a public deployment was performed. Updates validate, build, back up, migrate, restart and verify health without deleting volumes.

## 16. Domain and HTTPS

APP_DOMAIN is configurable. Use the bundled Caddy edge mode or the documented existing-proxy mode. Configure real DNS, forwarded headers and exact Google callback origin. HTTPS certificates require reachable domain infrastructure. No actual domain/DNS records were invented and no existing proxy was altered. **Public TLS issuance and production proxy-cookie behavior remain unverified.**

## 17. Backup and restore

Scripts create timestamped custom-format pg_dump archives, verify them using pg_restore listing plus checksums, use private directory/file permissions and limit retention to owned backup filenames. Restore requires exact confirmation and explicit production-maintenance acknowledgement; the runbook recommends testing into a separate database first. Actual isolated restore/retention/corruption/confirmation checks are recorded in INFRA_VERIFICATION.md. Off-VM copies remain an operator responsibility.

## 18. Verification

The maintained evidence summary is VERIFICATION.md, with Docker/backup detail in INFRA_VERIFICATION.md. Checks cover TypeScript, lint, unit/real PostgreSQL integration tests, production compilation, Docker builds/configuration and headless desktop/mobile Playwright flows. Browser authentication fixtures are inserted outside the app into isolated loopback test sessions; no test-login API exists. Local S3 uses a real compatible server rather than mocked application endpoints.

Dependency audit initially identified inherited high-severity Sharp issues. Direct Sharp was upgraded to 0.35.5; the subsequent Bun audit reported no vulnerabilities across 734 packages. This does not establish absence of all vulnerabilities.

## 19. Known limitations and deferred work

- Real Google login, external R2/AWS, production domain/TLS and real campus addresses/schedules require configuration and live verification.
- No real-world food-safety certification, precise indoor navigation, payment gateway, push notifications, favorites, reviews or AI. These were not substituted for required marketplace work.
- One session per venue/date and one active recurrence rule per weekday. Additional daily intervals require schema/service expansion.
- Store dashboard chooses the account's first accessible store; advanced multi-store switching is not implemented.
- Stock expiration is bounded/lazy on marketplace and reservation reads or explicit admin expiration. No continuous worker is required. Large installations should schedule bounded expiry calls and add paginated feeds/admin tables; initial reads are capped.
- Demo cleanup deliberately takes broad table locks to preserve genuine relationships. Use it in an isolated interview/demo environment, not as a high-frequency production operation.
- Concurrent upload finalizations can leave an unreferenced immutable approved object. Storage lifecycle/orphan cleanup is operational follow-up; it must not weaken private staging or byte validation.
- Mobile Lighthouse after accessibility fixes measured 89 performance / 100 accessibility (initially 84 / 92). The above-90 performance target remains unmet; LCP was 1.0 s and simulated total blocking time 370 ms on the shared local host.
- Admin tables are capped recent-record views; comprehensive per-table search/pagination and account-history drilldowns are not fully implemented.
- No independently measured claim of carbon reduction, food weight saved or production-scale load capacity is made.
- Tests may emit a pg 8 driver deprecation warning during transactional demo checks. Tests pass on the pinned compatible stack; investigate before a future pg 9 upgrade.

## 20. Deployment readiness

The application is implemented and locally verifiable, not a static prototype. Local checks do not establish that every external P0 acceptance criterion is satisfied. A production release still requires real Google/S3/domain configuration, verified public HTTPS/callback/media permissions, actual venue data, a successful off-VM backup policy and an operator-approved rollout. No public deployment or successful Google sign-in is claimed.

## Review and scope decisions

The independent backend review is BACKEND_REVIEW.md. Confirmed malformed discount, clean-category bootstrap, cancelled-schedule editing, materialization race and rendered-expiry findings were addressed. A subsequent production-container test also found streamed data leakage from layout-only admin guards; every admin page now authorizes before its own queries, with failing-then-passing raw-response and architectural regression tests and 60 negative production-response checks. Regressions cover the reproduced failures and transactional behaviors. Snapshotting listing mode was added to prevent later product edits from rewriting reported impact. React Native was not added because the supplied mandatory architecture is a Next.js web application.
