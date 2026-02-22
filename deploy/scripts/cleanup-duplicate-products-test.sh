#!/usr/bin/env bash
set -euo pipefail

# Inativa duplicados de produtos por nome no ambiente dev/test (ucmtest).
# Mantem apenas 1 ativo (prioriza com estoque, depois mais recente).
#
# Uso:
#   TENANT_ID=... NAME_PATTERN="Produto Teste%" bash deploy/scripts/cleanup-duplicate-products-test.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"
PROJECT_NAME="${PROJECT_NAME:-ucmtest}"

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

TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000000}"
NAME_PATTERN="${NAME_PATTERN:-Produto Teste%}"

echo "Tenant: ${TENANT_ID}"
echo "Filtro: ${NAME_PATTERN}"

docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" \
  -v tenant_id="$TENANT_ID" -v name_pattern="$NAME_PATTERN" -v ON_ERROR_STOP=1 <<'SQL'
WITH ranked AS (
  SELECT
    p.id,
    p.tenant_id,
    p.name,
    COALESCE(e.current_stock, 0) - COALESCE(e.reserved_stock, 0) AS available_stock,
    ROW_NUMBER() OVER (
      PARTITION BY p.tenant_id, lower(p.name)
      ORDER BY
        (COALESCE(e.current_stock, 0) - COALESCE(e.reserved_stock, 0) > 0) DESC,
        (COALESCE(e.current_stock, 0) - COALESCE(e.reserved_stock, 0)) DESC,
        p.created_at DESC
    ) AS rn
  FROM produtos p
  LEFT JOIN movimentacoes_estoque e
    ON e.tenant_id = p.tenant_id AND e.produto_id = p.id
  WHERE p.tenant_id = :'tenant_id'
    AND p.name ILIKE :'name_pattern'
    AND p.is_active = true
),
updated AS (
  UPDATE produtos p
  SET is_active = false
  FROM ranked r
  WHERE p.id = r.id AND r.rn > 1
  RETURNING p.id
)
SELECT count(*) AS inactivated FROM updated;
SQL

echo "Done. Se necessario, limpe o cache de produtos (Redis)."
