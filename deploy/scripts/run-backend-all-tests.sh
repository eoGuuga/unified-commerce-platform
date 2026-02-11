#!/usr/bin/env bash
set -euo pipefail

# Executa testes unit, integration e acid do backend no stack dev/test.
# Uso: bash deploy/scripts/run-backend-all-tests.sh

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

TEST_CMD="npm ci && npm run test:unit && npm run test:integration -- --runInBand && npm run test:acid"

docker run --rm \
  -v "${ROOT_DIR}/backend:/app" \
  -w /app \
  --network "$NET" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e REDIS_URL="$REDIS_URL" \
  node:20-alpine sh -lc "$TEST_CMD"
