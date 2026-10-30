#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/_common.sh"
usage() { echo 'Usage: scripts/restore.sh ARCHIVE [--database NAME] [--confirm "RESTORE NAME"]' >&2; }
[[ $# -ge 1 && "$1" != --help ]] || { usage; exit 2; }
archive="$1"; shift
[[ -f "$archive" && ! -L "$archive" ]] || { echo 'Archive must be an existing regular, non-symlink file.' >&2; exit 2; }
database="$(setting POSTGRES_DB imtor)"; confirmation=''
while (( $# )); do
  case "$1" in
    --database) [[ $# -ge 2 ]] || { usage; exit 2; }; database="$2"; shift 2;;
    --confirm) [[ $# -ge 2 ]] || { usage; exit 2; }; confirmation="$2"; shift 2;;
    *) usage; exit 2;;
  esac
done
[[ "$database" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]] || { echo 'Invalid database name.' >&2; exit 2; }
compose exec -T db pg_restore --list < "$archive" > /dev/null
if [[ "$database" == "$(setting POSTGRES_DB imtor)" && "${RESTORE_MAINTENANCE:-false}" != true ]]; then
  echo 'Main database restore requires stopped app/migrate writers and RESTORE_MAINTENANCE=true. Prefer a test database.' >&2
  exit 1
fi
expected="RESTORE $database"
if [[ "$confirmation" != "$expected" ]]; then
  echo "This replaces archive-owned objects and data in database '$database'. Type '$expected' to proceed:" >&2
  [[ -t 0 ]] || { echo 'Noninteractive restore needs explicit --confirm.' >&2; exit 1; }
  read -r confirmation
fi
[[ "$confirmation" == "$expected" ]] || { echo 'Restore cancelled.' >&2; exit 1; }
compose exec -T -e RESTORE_DB="$database" db sh -c 'pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --single-transaction -U "$POSTGRES_USER" -d "$RESTORE_DB"' < "$archive"
printf 'Restored archive into %s. Validate the application before resuming traffic.\n' "$database"
