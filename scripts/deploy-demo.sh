#!/usr/bin/env bash
# Explicit isolated presentation deployment; production guards remain unchanged.
set -Eeuo pipefail
# Compose prefers inherited shell values over --env-file. Only the validated
# private file may choose this deployment's DB, origin and networks.
unset DATABASE_URL APP_URL NEXTAUTH_URL POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD TZ \
  S3_PUBLIC_BASE_URL IMTOR_EDGE_NETWORK IMTOR_INTERNAL_NETWORK CLOUDFLARE_CONNECTOR \
  APP_DOMAIN ACME_EMAIL COMPOSE_PROFILES COMPOSE_FILE COMPOSE_PROJECT_NAME
export IMTOR_ENV_FILE="${IMTOR_ENV_FILE:-.env.deployment}" COMPOSE_MODE=tunnel
export IMTOR_PROJECT_NAME=imtor-demo
export IMAGE_TAG="${IMAGE_TAG:-demo-$(date -u +%Y%m%d%H%M%S)}"
source "$(dirname -- "$0")/_common.sh"
[[ "$IMAGE_TAG" =~ ^demo-[a-zA-Z0-9_.-]+$ ]] || { echo 'Use an immutable demo-* image tag.' >&2; exit 1; }
node "$ROOT_DIR/scripts/demo-env.mjs" "$IMTOR_ENV_FILE"
compose config --quiet
validate_tunnel_transition

# Do not adopt unowned volumes or collide with another application's Tunnel alias.
if docker volume inspect imtor-demo_postgres_data >/dev/null 2>&1; then
  [[ "$(docker volume inspect imtor-demo_postgres_data --format '{{index .Labels "com.docker.compose.project"}} {{index .Labels "com.docker.compose.volume"}}')" == 'imtor-demo postgres_data' ]] || { echo 'Demo volume ownership mismatch; nothing changed.' >&2; exit 1; }
fi
if docker network inspect imtor-demo-internal >/dev/null 2>&1; then
  [[ "$(docker network inspect imtor-demo-internal --format '{{index .Labels "com.docker.compose.project"}} {{.Internal}}')" == 'imtor-demo true' ]] || { echo 'Demo internal network ownership mismatch; nothing changed.' >&2; exit 1; }
fi
if docker network inspect imtor-edge >/dev/null 2>&1; then
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    if docker inspect "$id" --format '{{range .NetworkSettings.Networks}}{{range .Aliases}}{{println .}}{{end}}{{end}}' | grep -Fxq imtor-app; then
      [[ "$(docker inspect "$id" --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.service"}}')" == 'imtor-demo app' ]] || { echo 'Tunnel origin alias already belongs to another application; nothing changed.' >&2; exit 1; }
    fi
  done < <(docker network inspect imtor-edge --format '{{range $id, $_ := .Containers}}{{println $id}}{{end}}')
fi
if docker image inspect "imtor-app:$IMAGE_TAG" >/dev/null 2>&1; then
  docker image inspect "imtor-migration:$IMAGE_TAG" >/dev/null
  echo 'Reusing existing immutable demo image pair.'
else
  compose build app migrate
fi
"$ROOT_DIR/scripts/tunnel-network.sh"
compose up -d --wait db
compose up --no-deps --force-recreate --exit-code-from migrate migrate
compose run --rm --no-deps migrate bun scripts/seed-demo-once.ts
compose up -d --no-deps app
"$ROOT_DIR/scripts/healthcheck.sh"
printf 'Demo deployed with image tag %s. Public OAuth/media verification remains separate.\n' "$IMAGE_TAG"
