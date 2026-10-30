#!/usr/bin/env bash
# First install only. This does not configure DNS or touch an existing proxy.
set -Eeuo pipefail
source "$(dirname -- "$0")/_common.sh"
validate_config
validate_tunnel_transition
# Existing databases belong to update.sh, which verifies a backup first.
if compose ps --status running --services db | grep -qx db || docker volume inspect "${IMTOR_PROJECT_NAME:-imtor}_postgres_data" >/dev/null 2>&1; then
  echo 'Database/volume already exists: use scripts/update.sh (backup before migrations).' >&2; exit 1
fi
compose build app migrate
if [[ "${COMPOSE_MODE:-external}" == tunnel ]]; then "$ROOT_DIR/scripts/tunnel-network.sh"; fi
compose up -d --wait db
compose up --no-deps --force-recreate --exit-code-from migrate migrate
compose up -d --no-deps app
"$ROOT_DIR/scripts/healthcheck.sh"
if [[ "${COMPOSE_MODE:-external}" == caddy ]]; then compose up -d --no-deps caddy; fi
