#!/usr/bin/env bash
# Additive attachment only: no connector restart, token inspection or route mutation.
set -Eeuo pipefail
export IMTOR_ENV_FILE="${IMTOR_ENV_FILE:-.env.production}" COMPOSE_MODE=tunnel
source "$(dirname -- "$0")/_common.sh"
network="$(setting IMTOR_EDGE_NETWORK imtor-edge)"
connector="$(setting CLOUDFLARE_CONNECTOR cloudflare-connector)"
[[ "$network" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ && "$connector" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || { echo 'Invalid network/container name.' >&2; exit 2; }
[[ "$(docker inspect --format '{{.State.Running}}' "$connector")" == true ]] || { echo 'Existing connector must be running; nothing recreated.' >&2; exit 1; }
if ! docker network inspect "$network" >/dev/null 2>&1; then
  docker network create --driver bridge --label app=imtor "$network" >/dev/null || docker network inspect "$network" >/dev/null
fi
[[ "$(docker network inspect --format '{{.Driver}} {{.Internal}}' "$network")" == 'bridge false' ]] || { echo 'Edge must be a non-internal bridge network.' >&2; exit 1; }
if ! docker network inspect --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' "$network" | grep -Fxq -- "$connector"; then
  docker network connect "$network" "$connector"
  echo "Attached $connector to $network; existing networks retained."
else
  echo "$connector already joins $network; unchanged."
fi
