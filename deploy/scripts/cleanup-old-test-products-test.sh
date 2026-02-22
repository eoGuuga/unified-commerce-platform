#!/usr/bin/env bash
set -euo pipefail

# Inativa produtos de teste antigos por nome (ucmtest).
# Requer OLDER_THAN_DAYS para evitar execucao acidental.
#
# Uso:
#   TENANT_ID=... NAME_PATTERN="%Teste%" OLDER_THAN_DAYS=30 \
#     bash deploy/scripts/cleanup-old-test-products-test.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"
PROJECT_NAME="${PROJECT_NAME:-ucmtest}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${OLDER_THAN_DAYS:-}" ]]; then
  echo "Defina OLDER_THAN_DAYS (ex.: 30) para executar este script." >&2
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

TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000000}"
NAME_PATTERN="${NAME_PATTERN:-%Teste%}"

echo "Tenant: ${TENANT_ID}"
echo "Filtro: ${NAME_PATTERN}"
echo "Older than (days): ${OLDER_THAN_DAYS}"

docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" \
  -v tenant_id="$TENANT_ID" -v name_pattern="$NAME_PATTERN" -v older_days="$OLDER_THAN_DAYS" -v ON_ERROR_STOP=1 <<'SQL'
WITH updated AS (
  UPDATE produtos
  SET is_active = false
  WHERE tenant_id = :'tenant_id'
    AND name ILIKE :'name_pattern'
    AND is_active = true
    AND created_at < NOW() - (:'older_days' || ' days')::interval
  RETURNING id
)
SELECT count(*) AS inactivated FROM updated;
SQL

echo "Done. Se necessario, limpe o cache de produtos (Redis)."
