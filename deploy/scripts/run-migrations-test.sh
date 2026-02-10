#!/usr/bin/env bash
set -euo pipefail

# Aplica migrations SQL no Postgres do stack dev/test.
# Uso: bash deploy/scripts/run-migrations-test.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"
PROJECT_NAME="ucmtest"
MIG_DIR="${ROOT_DIR}/scripts/migrations"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

docker compose --env-file "$ENV_FILE" \
  -f "${ROOT_DIR}/deploy/docker-compose.test.yml" \
  --project-name "$PROJECT_NAME" up -d postgres

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

if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_FROM_URL="${DATABASE_URL##*/}"
  DB_FROM_URL="${DB_FROM_URL%%\?*}"
  if [[ -n "$DB_FROM_URL" ]]; then
    PG_DB="$DB_FROM_URL"
  fi
fi

TABLE_EXISTS="$(docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT to_regclass('public.tenants') IS NOT NULL;")"

MIGRATIONS=(
  "001-initial-schema.sql"
  "002-security-and-performance.sql"
  "003-whatsapp-conversations.sql"
  "004-audit-log-metadata.sql"
  "005-audit-action-enum-values.sql"
  "006-idempotency.sql"
  "007-add-coupon-code-to-pedidos.sql"
  "008-usuarios-email-unique-por-tenant.sql"
  "009-rls-force-and-extra-policies.sql"
  "010-idempotency-unique-tenant-operation.sql"
  "011-create-pagamentos-table.sql"
  "012-tenants-rls-policy.sql"
)

if [[ "$TABLE_EXISTS" == "t" ]]; then
  MIGRATIONS=("${MIGRATIONS[@]:1}")
  echo "Schema existente detectado; pulando 001-initial-schema.sql."
fi

for f in "${MIGRATIONS[@]}"; do
  path="${MIG_DIR}/${f}"
  if [[ -f "${path}" ]]; then
    echo "Aplicando ${f}..."
    docker exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" < "$path"
  fi
done

echo "OK: migrations aplicadas no projeto ${PROJECT_NAME}."
