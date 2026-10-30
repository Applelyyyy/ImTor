#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/_common.sh"
retries="${HEALTH_RETRIES:-30}"
[[ "$retries" =~ ^[1-9][0-9]*$ ]] || { echo 'HEALTH_RETRIES must be a positive integer.' >&2; exit 2; }
for ((attempt=1; attempt<=retries; attempt++)); do
  if compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo 'ImTor application/database health check passed.'
    exit 0
  fi
  sleep 2
done
echo 'ImTor health failed; inspect docker compose logs app migrate db (redact secrets).' >&2
exit 1
