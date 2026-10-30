#!/usr/bin/env bash
# Roll back only the app image. Database/media changes are preserved; no migration or reseed.
set -euo pipefail
cd "$(dirname "$0")/.."
export IMTOR_ENV_FILE=.env.deployment IMAGE_TAG=demo-ui-20261030-1715
docker image inspect "imtor-app:$IMAGE_TAG" >/dev/null
docker compose --env-file .env.deployment -p imtor-demo -f compose.yaml -f compose.tunnel.yaml up -d --no-deps --no-build --wait --wait-timeout 120 app
