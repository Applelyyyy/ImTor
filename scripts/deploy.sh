#!/usr/bin/env bash
# First install only. This does not configure DNS or touch an existing proxy.
set -Eeuo pipefail
source "$(dirname -- "$0")/_common.sh"
validate_config
compose build app migrate
compose up -d --wait db
compose up --no-deps --force-recreate --exit-code-from migrate migrate
compose up -d --no-deps app
"$ROOT_DIR/scripts/healthcheck.sh"
if [[ "${COMPOSE_MODE:-external}" == caddy ]]; then compose up -d --no-deps caddy; fi
