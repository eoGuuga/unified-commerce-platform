#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"
PROJECT_NAME="ucmtest"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

"${ROOT_DIR}/deploy/scripts/seed-test-tenant.sh"

NET="$(docker network ls --filter label=com.docker.compose.project=${PROJECT_NAME} --format '{{.Name}}' | head -n 1)"
if [[ -z "$NET" ]]; then
  echo "Rede do projeto ${PROJECT_NAME} nao encontrada." >&2
  exit 1
fi

docker run --rm \
  -v "${ROOT_DIR}/backend:/app" \
  -w /app \
  --network "$NET" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e REDIS_URL="$REDIS_URL" \
  node:20-alpine sh -lc "npm ci && npm run test:integration -- --runInBand"
