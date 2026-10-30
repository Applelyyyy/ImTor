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
  tunnel) COMPOSE+=(-f "$ROOT_DIR/compose.tunnel.yaml");;
  external) COMPOSE+=(-f "$ROOT_DIR/compose.external-proxy.yaml");;
  caddy) COMPOSE+=(--profile edge);;
  dev) COMPOSE+=(-f "$ROOT_DIR/compose.dev.yaml");;
  *) echo 'COMPOSE_MODE must be tunnel, external, caddy, or dev' >&2; exit 2;;
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
  if [[ "${COMPOSE_MODE:-external}" != dev ]]; then
    if command -v node >/dev/null && node -e "require('node:util').parseEnv('KEY=value')" 2>/dev/null; then
      node "$ROOT_DIR/scripts/production-env.mjs" "$IMTOR_ENV_FILE" "${COMPOSE_MODE:-external}"
    else
      docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
        -v "$IMTOR_ENV_FILE:/run/imtor.env:ro" -v "$ROOT_DIR/scripts/production-env.mjs:/check.mjs:ro" \
        node:24.22.0-bookworm-slim node /check.mjs /run/imtor.env "${COMPOSE_MODE:-external}"
    fi
  fi
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

# A changed Compose file does not move an existing DB or stop an old Caddy.
validate_tunnel_transition() {
  [[ "${COMPOSE_MODE:-external}" == tunnel ]] || return 0
  local project="${IMTOR_PROJECT_NAME:-imtor}" caddy_id db_id expected
  caddy_id="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=caddy)"
  [[ -z "$caddy_id" ]] || { echo 'Existing project Caddy is active. Complete the controlled Tunnel conversion in docs/SELF_HOSTED_DEPLOYMENT.md first.' >&2; exit 1; }
  db_id="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=db)"
  [[ -n "$db_id" ]] || return 0
  expected="$(setting IMTOR_INTERNAL_NETWORK imtor-internal)"
  local -a networks
  mapfile -t networks < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' "$db_id" | sed '/^$/d')
  if [[ ${#networks[@]} -ne 1 || "${networks[0]:-}" != "$expected" || "$(docker inspect --format '{{len .HostConfig.PortBindings}}' "$db_id")" != 0 ]]; then
    echo 'Existing database networking differs from private Tunnel mode. Back up and complete the controlled conversion in docs/SELF_HOSTED_DEPLOYMENT.md first.' >&2
    exit 1
  fi
}
