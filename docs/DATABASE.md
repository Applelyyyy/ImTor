# Database

PostgreSQL is the sole application datastore. Prisma 7 uses the PostgreSQL driver adapter and generates the client into `src/generated/prisma`; `prisma.config.ts` reads `DATABASE_URL`. Never import a stale generated client after schema changes.

## Entity groups

| Domain | Tables and relationships |
|---|---|
| Identity | User, Account (Google provider identity), Session, VerificationToken |
| Merchant | Store → owner User; StoreMember for delegated access |
| Venues | MarketVenue → MarketZone → MarketStall |
| Schedule | MarketScheduleRule + MarketScheduleException → dated MarketSession |
| Attendance | StoreAttendance joins Store/session; StallAssignment binds attendance to a timed stall |
| Catalog | ProductCategory → Product; Product belongs to Store and optionally session; DiscountRule |
| Inventory | Reservation stores customer, quantity, snapshot prices and listing mode, pickup code and expiry; InventoryMovement records deltas |
| Operations | SystemSetting, Report, AuditLog, DemoBatch, Upload, RateLimit |

User/provider IDs and session secrets are not public DTO fields. Demo lineage uses `demoBatchId`; child objects inherit lineage through their parent. A real user's reservation against a demo product must not be silently deleted by batch cleanup: cleanup must refuse unsafe cross-lineage dependencies. Monetary values are integer satang (100 = THB 1), not floating point baht.

## Integrity

Unique keys cover provider identity, store slug, venue/date sessions, venue/stall code, store/session attendance and attendance assignment. Service transactions and migration-level constraints protect stock and conflicting stall time intervals. Reservations snapshot both prices and `productMode`, so editing a product later cannot rewrite historical pickup impact classification. Reservations decrement finite stock atomically, cancellation/expiry restores it exactly once, and pickup completion must not restore it. Unlimited stock is represented explicitly and must not be confused with zero. Authorization checks run before transaction side effects.

Persisted timestamps are UTC instants. Venue calendar dates and recurrence anchors are separate `YYYY-MM-DD` fields interpreted in the venue timezone (initially Asia/Bangkok); never truncate a UTC instant to determine a Bangkok date.

## Commands

```bash
bun run db:generate      # no database mutation
bun run db:migrate       # prisma migrate deploy; reviewed committed migrations only
bun run db:seed          # explicit fictional demo generation; isolated demo database only
```

The committed migration chain includes the generated schema/invariants, a documented empty bootstrap placeholder retained in history, canonical product categories for ordinary non-demo onboarding, and the reservation listing-mode snapshot. Categories do not require enabling the demo generator.

Create new migrations during development with `bun x prisma migrate dev --name DESCRIPTIVE_NAME`, review SQL, commit schema and migration together, and use `migrate deploy` on the VM. Never run `migrate reset`, `db push --accept-data-loss` or development migrations on a production database. For Prisma 7 the datasource URL belongs in `prisma.config.ts`, not an obsolete schema `url` field.

## Storage and tests

Production database image is pinned to PostgreSQL 18.3. Its named volume mounts `/var/lib/postgresql` (PostgreSQL 18 image layout), not the pre-18 path `/var/lib/postgresql/data`. A major PostgreSQL upgrade requires a planned dump/restore or `pg_upgrade`; changing an image tag is not an upgrade procedure.

Use a distinct test database and test environment, never production, for integration and browser mutations. Logical backups do not include server roles, external S3 files, TLS certificates or environment secrets. See [Backup and restore](BACKUP_RESTORE.md).

## Isolated integration test setup

Unit tests are database-independent (`bun run test:unit`). Integration tests use an explicit `TEST_DATABASE_URL` override; the guard requires a loopback/Compose `db` hostname and a database name ending in `_test`. Never set it to the main `imtor` database. `.env.example` includes an optional local `imtor_test` URL; keep its password consistent with your development database and never print it.

```bash
# Local development DB service already healthy; create once:
IMTOR_ENV_FILE=.env docker compose --env-file .env -f compose.yaml exec -T db \
  sh -c 'createdb -U "$POSTGRES_USER" imtor_test'
# Securely export TEST_DATABASE_URL in this shell (or use your local secret manager).
# Apply the same committed migrations to the isolated test DB:
: "${TEST_DATABASE_URL:?Securely export the isolated test URL first}"
DATABASE_URL="$TEST_DATABASE_URL" bun run db:migrate
bun run test:integration
```

If the URL exists only in `.env` rather than the shell, run the migration without printing the value:

```bash
bun --env-file=.env -e 'if(!process.env.TEST_DATABASE_URL)throw Error("Set TEST_DATABASE_URL"); const p=Bun.spawnSync(["bun","run","db:migrate"],{stdio:["inherit","inherit","inherit"],env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL}}); process.exit(p.exitCode)'
```

The database-name/host guard is a test safety net, not proof that a database contains only disposable data. Use an intentionally created local test database and never override that guard for convenience. Main `.env` `DATABASE_URL` continues serving the app; integration configuration selects the test URL instead. Browser tests create isolated session fixtures through a test CLI, not a runtime public authentication bypass; a passing browser test does not verify Google OAuth.
