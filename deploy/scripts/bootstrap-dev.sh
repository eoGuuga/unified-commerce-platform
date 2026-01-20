#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

echo "==> Subindo containers dev/test"
docker compose --env-file "$ENV_FILE" \
  -f "${ROOT_DIR}/deploy/docker-compose.test.yml" \
  --project-name ucmtest up -d --build --force-recreate postgres redis backend frontend nginx

echo "==> Garantindo tenant de teste"
"${ROOT_DIR}/deploy/scripts/seed-test-tenant.sh"

echo "==> Seed de dados basicos"
"${ROOT_DIR}/deploy/scripts/seed-dev-data.sh"

echo "==> Smoke test"
"${ROOT_DIR}/deploy/scripts/run-dev-smoke.sh"

echo "Bootstrap dev OK."
