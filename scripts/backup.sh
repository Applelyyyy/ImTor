#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/_common.sh"
umask 077
backup_dir="$(setting BACKUP_DIRECTORY "$ROOT_DIR/backups")"
[[ "$backup_dir" = /* ]] || backup_dir="$ROOT_DIR/$backup_dir"
[[ ! -L "$backup_dir" ]] || { echo 'Backup directory must not be a symlink.' >&2; exit 1; }
retention="$(setting BACKUP_RETENTION_DAYS 14)"
[[ "$retention" =~ ^[1-9][0-9]*$ ]] || { echo 'BACKUP_RETENTION_DAYS must be a positive integer.' >&2; exit 2; }
mkdir -p -- "$backup_dir"
chmod 700 "$backup_dir"
backup_dir="$(cd -- "$backup_dir" && pwd)"
archive="$(mktemp "$backup_dir/imtor-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump")"
complete=false
trap 'if [[ "$complete" != true ]]; then rm -f -- "$archive" "$archive.sha256"; fi' EXIT
compose exec -T db sh -c 'pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$archive"
[[ -s "$archive" ]]
compose exec -T db pg_restore --list < "$archive" > /dev/null
(cd -- "$backup_dir" && sha256sum "$(basename -- "$archive")" > "$(basename -- "$archive").sha256")
chmod 600 "$archive" "$archive.sha256"
complete=true
# Retention applies only after a new archive is verified, only to our own names.
while IFS= read -r -d '' old; do
  rm -f -- "$old" "$old.sha256"
done < <(find "$backup_dir" -maxdepth 1 -type f -name 'imtor-*.dump' -mtime "+$retention" -print0)
printf '%s\n' "$archive"
