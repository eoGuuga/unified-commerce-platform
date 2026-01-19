#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"
PROJECT_NAME="ucmtest"
TENANT_ID="00000000-0000-0000-0000-000000000000"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

docker compose --env-file "$ENV_FILE" \
  -f "${ROOT_DIR}/deploy/docker-compose.test.yml" \
  --project-name "$PROJECT_NAME" up -d postgres redis

PG_CONTAINER="$(docker ps \
  --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
  --filter "label=com.docker.compose.service=postgres" \
  --format '{{.Names}}' | head -n 1)"

if [[ -z "$PG_CONTAINER" ]]; then
  echo "Container postgres do projeto ${PROJECT_NAME} nao encontrado." >&2
  exit 1
fi

PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-ucm}"

docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL row_security = off;
INSERT INTO "tenants"("id", "name", "slug", "settings", "is_active")
VALUES ('${TENANT_ID}', 'Test Tenant', 'test-tenant', '{}', true)
ON CONFLICT ("id") DO NOTHING;
COMMIT;
SQL

echo "Tenant de teste garantido: ${TENANT_ID}"
