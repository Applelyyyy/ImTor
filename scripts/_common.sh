#!/usr/bin/env bash
# Shared implementation; invoke the public scripts, not this file.
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export IMTOR_ENV_FILE="${IMTOR_ENV_FILE:-.env}"
[[ "$IMTOR_ENV_FILE" = /* ]] || IMTOR_ENV_FILE="$ROOT_DIR/$IMTOR_ENV_FILE"
export IMTOR_ENV_FILE
[[ -f "$IMTOR_ENV_FILE" ]] || { echo "Missing environment file: $IMTOR_ENV_FILE" >&2; exit 1; }
COMPOSE=(docker compose --project-name "${IMTOR_PROJECT_NAME:-imtor}" --env-file "$IMTOR_ENV_FILE" -f "$ROOT_DIR/compose.yaml")
case "${COMPOSE_MODE:-external}" in
  external) COMPOSE+=(-f "$ROOT_DIR/compose.external-proxy.yaml");;
  caddy) COMPOSE+=(--profile edge);;
  dev) COMPOSE+=(-f "$ROOT_DIR/compose.dev.yaml");;
  *) echo 'COMPOSE_MODE must be external, caddy, or dev' >&2; exit 2;;
esac
compose() { "${COMPOSE[@]}" "$@"; }
# Read literal script settings only; never execute an environment file as shell code.
# Script settings must be simple single-line values (no ${...} interpolation).
setting() {
  local key="$1" default="${2:-}" value
  value="${!key:-}"
  if [[ -z "$value" ]]; then
    value="$(awk -v key="$key" 'index($0,key"=")==1 {sub("^[^=]*=", ""); sub(/\r$/, ""); value=$0} END {print value}' "$IMTOR_ENV_FILE")"
    value="${value#\"}"; value="${value%\"}"; value="${value#\'}"; value="${value%\'}"
  fi
  printf '%s' "${value:-$default}"
}
validate_config() {
  compose config --quiet
  local app_url auth_url secret
  app_url="$(setting APP_URL)"; auth_url="$(setting NEXTAUTH_URL)"; secret="$(setting AUTH_SECRET)"
  [[ "$app_url" == "$auth_url" && -n "$app_url" ]] || { echo 'APP_URL and NEXTAUTH_URL must match.' >&2; exit 1; }
  [[ ${#secret} -ge 32 && "$secret" != *REPLACE* && "$secret" != *replace-with* ]] || { echo 'Generate a random AUTH_SECRET of at least 32 characters.' >&2; exit 1; }
  if [[ "${COMPOSE_MODE:-external}" != dev ]]; then
    [[ "$(setting DEMO_MODE false)" == false && "$(setting ENABLE_DEMO_GENERATOR false)" == false ]] || { echo 'Production scripts require demo features disabled; use a separate local demo stack.' >&2; exit 1; }
    [[ "$app_url" == https://* ]] || { echo 'Production APP_URL must use HTTPS.' >&2; exit 1; }
    for key in POSTGRES_PASSWORD DATABASE_URL AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET; do
      local value; value="$(setting "$key")"
      [[ -n "$value" && "$value" != *REPLACE* && "$value" != *replace-with* ]] || { echo "Configure $key before production deployment." >&2; exit 1; }
    done
  fi
}
