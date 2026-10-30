# Backup, restore and recovery

## Logical backups

```bash
export IMTOR_ENV_FILE=.env.production COMPOSE_MODE=external
./scripts/backup.sh
```

The running PostgreSQL service is required. The script uses `pg_dump --format=custom --no-owner --no-acl`, a timestamp/random suffix filename, `umask 077`, directory mode 700 and archive/checksum mode 600. It verifies a nonempty archive with `pg_restore --list`, records SHA-256, then applies retention only to its own `imtor-*.dump` names in `BACKUP_DIRECTORY`. Failures remove the incomplete archive and do not purge old backups. Symlink backup directories are rejected. `BACKUP_RETENTION_DAYS` must be a positive integer; retention uses whole-day `find -mtime` semantics, not a real-time expiry SLA.

`pg_restore --list` validates the archive directory/readability, **not** a full restore of every data block. A periodic restore drill into a separate database is the stronger verification. PostgreSQL uses a transactionally consistent dump snapshot even while ordinary writes continue. Plan additional controls for coordinated S3/application snapshots if needed.

Set `BACKUP_DIRECTORY` to a secure local filesystem path; script-only settings are literal single-line values (no shell execution or `${...}` interpolation). Store encrypted copies off the VM, protect encryption keys independently, monitor backup age/failure/disk usage and retain according to recovery policy. Local retention is not disaster recovery. The scripts never upload archives or credentials anywhere automatically.

## Test-database restore drill (recommended)

Use an isolated database on the same PostgreSQL server **only for a drill**; it must not be the production database named by the app. Example with standard `imtor` DB user and explicit names:

```bash
export IMTOR_ENV_FILE=.env.production
# The env_file argument must match the file above.
docker compose --env-file .env.production -f compose.yaml exec -T db \
  sh -c 'createdb -U "$POSTGRES_USER" imtor_restore_test'
# Set ARCHIVE to the exact absolute path printed by backup.sh.
ARCHIVE=/ABSOLUTE/PATH/TO/imtor-TIMESTAMP-SUFFIX.dump
(cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$ARCHIVE").sha256")
./scripts/restore.sh "$ARCHIVE" --database imtor_restore_test --confirm 'RESTORE imtor_restore_test'
# Inspect expected objects/rows; do not point the live app at the drill database.
docker compose --env-file .env.production -f compose.yaml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d imtor_restore_test -c "SELECT count(*) FROM \"User\";"'
```

Use a separate temporary application/environment if you want to exercise restored app behavior; disable external side effects and avoid production S3 writes. Review restored relations, inventory/reservation consistency and migration status. Drop a drill database only after the operator explicitly confirms it is the expendable test database; no automatic destructive cleanup is included here.

## Main-database restore (destructive)

Restoration replaces archive-owned objects/data in the chosen database. Stop all application/worker/migration writers and restrict traffic first. Ensure a fresh pre-restore backup is available. The script requires explicit confirmation; default main database additionally requires `RESTORE_MAINTENANCE=true`, an operator assertion that maintenance is in effect. It cannot prove unrelated writers are stopped.

```bash
# Operator-approved maintenance window only; target ImTor app, not other VM services.
export IMTOR_ENV_FILE=.env.production COMPOSE_MODE=external
docker compose --env-file .env.production -f compose.yaml stop app
RESTORE_MAINTENANCE=true ./scripts/restore.sh "$ARCHIVE" --confirm 'RESTORE imtor'
# Use application/migrations compatible with this backup before resuming:
docker compose --env-file .env.production -f compose.yaml up -d --no-deps app
./scripts/healthcheck.sh
```

Replace `imtor` if `POSTGRES_DB` differs. The archive is checked before restoration. Restore uses `--clean --if-exists --no-owner --no-acl --exit-on-error --single-transaction`, so an SQL failure rolls back rather than continuing silently. It does not delete unrelated objects not present in the archive, create the target database or restore server roles. It never removes Docker volumes. Confirm business flows and external image references before reopening traffic; an internal health check alone is insufficient.

Never restore to production merely to test an archive. Never assume reverting an image reverses a database migration. Never use `docker compose down -v`, database reset or volume pruning as an update/recovery shortcut.

See [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) and [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
