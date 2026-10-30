#!/usr/bin/env bash
# Run after reviewing/pulling source. No git reset/pull and no volume deletion.
set -Eeuo pipefail
source "$(dirname -- "$0")/_common.sh"
validate_config
compose build app migrate
# Existing database must already be healthy: don't silently replace its image.
compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > /dev/null
backup="$("$ROOT_DIR/scripts/backup.sh")"
printf 'Verified pre-update archive: %s\n' "$backup"
compose up --no-deps --force-recreate --exit-code-from migrate migrate
compose up -d --no-deps --force-recreate app
"$ROOT_DIR/scripts/healthcheck.sh"
if [[ "${COMPOSE_MODE:-external}" == caddy ]]; then compose up -d --no-deps caddy; fi
