#!/usr/bin/env bash
set -euo pipefail

# Executa validacoes finais de entrega com relatorio.
# Uso (dev/test):
#   TARGET_ENV=devtest bash deploy/scripts/run-final-delivery-gate.sh
#
# Uso (producao):
#   TARGET_ENV=prod bash deploy/scripts/run-final-delivery-gate.sh
#
# Flags uteis:
#   RUN_TESTS=1                # roda deploy/scripts/run-backend-all-tests.sh
#   RUN_WHATSAPP_TEST=1        # valida /api/v1/whatsapp/test
#   TENANT_ID=<uuid>           # tenant para teste WhatsApp
#   PHONE_NUMBER=<numero>      # telefone para teste WhatsApp

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/deploy/.env}"
TARGET_ENV="${TARGET_ENV:-devtest}"            # devtest | prod
RUN_TESTS="${RUN_TESTS:-0}"
RUN_WHATSAPP_TEST="${RUN_WHATSAPP_TEST:-0}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000000}"
PHONE_NUMBER="${PHONE_NUMBER:-+5511998887790}"
BACKUP_DIR="${BACKUP_DIR:-/opt/ucm/backups}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

case "$TARGET_ENV" in
  devtest)
    PROJECT_NAME="${PROJECT_NAME:-ucmtest}"
    COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/docker-compose.test.yml}"
    BASE_URL="${BASE_URL:-https://dev.gtsofthub.com.br}"
    ;;
  prod)
    PROJECT_NAME="${PROJECT_NAME:-ucm}"
    COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/deploy/docker-compose.prod.yml}"
    BASE_URL="${BASE_URL:-https://gtsofthub.com.br}"
    ;;
  *)
    echo "TARGET_ENV invalido: ${TARGET_ENV}. Use devtest ou prod." >&2
    exit 1
    ;;
esac

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file nao encontrado: $COMPOSE_FILE" >&2
  exit 1
fi

REPORT_DIR="${REPORT_DIR:-${ROOT_DIR}/deploy/reports}"
mkdir -p "$REPORT_DIR"
REPORT_FILE="${REPORT_DIR}/final-gate-${TARGET_ENV}-$(date -u +%Y%m%dT%H%M%SZ).log"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

exec > >(tee -a "$REPORT_FILE") 2>&1

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] $1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo "[WARN] $1"
}

check_cmd() {
  local description="$1"
  shift
  if "$@"; then
    pass "$description"
  else
    fail "$description"
  fi
}

trim_ws() {
  local value="${1:-}"
  # remove espacos, tabs e \r/\n para comparacoes robustas
  echo "$value" | tr -d '[:space:]'
}

get_running_container() {
  local service="$1"
  local by_label by_name

  by_label="$(docker ps \
    --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
    --filter "label=com.docker.compose.service=${service}" \
    --format '{{.Names}}' | head -n 1)"
  if [[ -n "$by_label" ]]; then
    echo "$by_label"
    return 0
  fi

  if [[ "$TARGET_ENV" == "devtest" ]]; then
    case "$service" in
      postgres) by_name="ucm-postgres-test" ;;
      redis) by_name="ucm-redis-test" ;;
      *) by_name="" ;;
    esac
  else
    case "$service" in
      postgres) by_name="ucm-postgres" ;;
      redis) by_name="ucm-redis" ;;
      *) by_name="" ;;
    esac
  fi

  if [[ -n "$by_name" ]] && docker ps --format '{{.Names}}' | grep -qx "$by_name"; then
    echo "$by_name"
  fi
}

http_code() {
  local url="$1"
  curl -k -sS -o /dev/null -w "%{http_code}" --max-time 20 "$url" || true
}

wait_http_200() {
  local url="$1"
  local attempts="${2:-12}"
  local wait_seconds="${3:-2}"
  local i code
  for ((i = 1; i <= attempts; i++)); do
    code="$(http_code "$url")"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    sleep "$wait_seconds"
  done
  return 1
}

set -a
source "$ENV_FILE"
set +a

echo "========================================"
echo "Final Delivery Gate"
echo "UTC now: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Target env: $TARGET_ENV"
echo "Base URL: $BASE_URL"
echo "Project: $PROJECT_NAME"
echo "Env file: $ENV_FILE"
echo "Compose file: $COMPOSE_FILE"
echo "Report: $REPORT_FILE"
echo "========================================"

check_cmd "docker disponivel" docker ps
check_cmd "docker compose disponivel" docker compose version

PRE_PG_CONTAINER="$(get_running_container postgres || true)"
PRE_REDIS_CONTAINER="$(get_running_container redis || true)"
if [[ -n "$PRE_PG_CONTAINER" && -n "$PRE_REDIS_CONTAINER" ]]; then
  pass "postgres/redis ja em execucao (skip compose up)"
else
  check_cmd "subir postgres/redis no compose alvo" \
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d postgres redis
fi

STACK_CONTAINERS="$(docker ps \
  --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
  --format '{{.Names}}' | wc -l | tr -d ' ')"
if [[ "${STACK_CONTAINERS:-0}" -gt 0 || -n "${PRE_PG_CONTAINER:-}" || -n "${PRE_REDIS_CONTAINER:-}" ]]; then
  pass "containers do projeto ${PROJECT_NAME} em execucao"
else
  fail "containers do projeto ${PROJECT_NAME} em execucao"
fi

check_cmd "health /api/v1/health (200)" wait_http_200 "${BASE_URL%/}/api/v1/health"
check_cmd "health /api/v1/health/live (200)" wait_http_200 "${BASE_URL%/}/api/v1/health/live"
check_cmd "health /api/v1/health/ready (200)" wait_http_200 "${BASE_URL%/}/api/v1/health/ready"

ROOT_CODE="$(http_code "${BASE_URL%/}/")"
if [[ "$ROOT_CODE" == "200" || "$ROOT_CODE" == "301" || "$ROOT_CODE" == "302" ]]; then
  pass "endpoint raiz respondeu (code=${ROOT_CODE})"
else
  fail "endpoint raiz respondeu (code=${ROOT_CODE})"
fi

if [[ -n "${DB_APP_USER:-}" ]]; then
  pass "DB_APP_USER definido"
else
  fail "DB_APP_USER definido"
fi

if [[ -n "${DB_APP_PASSWORD:-}" ]]; then
  pass "DB_APP_PASSWORD definido"
else
  fail "DB_APP_PASSWORD definido"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  pass "DATABASE_URL definido"
else
  fail "DATABASE_URL definido"
fi

if [[ -n "${REDIS_PASSWORD:-}" ]]; then
  pass "REDIS_PASSWORD definido"
else
  fail "REDIS_PASSWORD definido"
fi

if [[ "$TARGET_ENV" == "prod" ]]; then
  if [[ "${SEED_DEV_USER:-false}" == "true" ]]; then
    fail "SEED_DEV_USER=false em producao"
  else
    pass "SEED_DEV_USER=false em producao"
  fi

  if [[ "${ALLOW_TENANT_FROM_REQUEST:-false}" == "true" ]]; then
    fail "ALLOW_TENANT_FROM_REQUEST=false em producao"
  else
    pass "ALLOW_TENANT_FROM_REQUEST=false em producao"
  fi
fi

POSTGRES_CONTAINER="$(get_running_container postgres || true)"
REDIS_CONTAINER="$(get_running_container redis || true)"

if [[ -z "$POSTGRES_CONTAINER" ]]; then
  fail "container postgres encontrado"
else
  pass "container postgres encontrado (${POSTGRES_CONTAINER})"
fi

if [[ -z "$REDIS_CONTAINER" ]]; then
  fail "container redis encontrado"
else
  pass "container redis encontrado (${REDIS_CONTAINER})"
fi

if [[ -n "$POSTGRES_CONTAINER" && -n "${DB_APP_USER:-}" ]]; then
  PG_USER="${POSTGRES_USER:-postgres}"
  PG_DB="${POSTGRES_DB:-ucm}"
  ROLE_ROW="$(docker exec -i "$POSTGRES_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -At \
    -c "select rolname || '|' || rolsuper || '|' || rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' || rolbypassrls from pg_roles where rolname='${DB_APP_USER}'" || true)"

  if [[ -z "$ROLE_ROW" ]]; then
    fail "role do app existe no postgres (${DB_APP_USER})"
  else
    IFS='|' read -r role_name role_super role_createdb role_createrole role_replication role_bypassrls <<< "$ROLE_ROW"
    role_name="$(trim_ws "$role_name")"
    role_super="$(trim_ws "$role_super")"
    role_createdb="$(trim_ws "$role_createdb")"
    role_createrole="$(trim_ws "$role_createrole")"
    role_replication="$(trim_ws "$role_replication")"
    role_bypassrls="$(trim_ws "$role_bypassrls")"
    pass "role do app existe no postgres (${role_name})"
    if [[ "$role_super" == "f" && "$role_createdb" == "f" && "$role_createrole" == "f" && "$role_replication" == "f" && "$role_bypassrls" == "f" ]]; then
      pass "role do app sem privilegios elevados"
    else
      fail "role do app sem privilegios elevados"
    fi
  fi

  RLS_POLICIES="$(docker exec -i "$POSTGRES_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -At \
    -c "select count(*) from pg_policies where schemaname='public'" || echo "0")"
  if [[ "${RLS_POLICIES:-0}" -gt 0 ]]; then
    pass "RLS com politicas cadastradas (${RLS_POLICIES})"
  else
    warn "RLS sem politicas visiveis no schema public"
  fi
fi

if [[ -n "$REDIS_CONTAINER" ]]; then
  REDIS_NOAUTH_OUT="$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>&1 || true)"
  if [[ "$REDIS_NOAUTH_OUT" == *"NOAUTH"* ]]; then
    pass "redis exige autenticacao sem senha"
  else
    fail "redis exige autenticacao sem senha"
  fi

  REDIS_AUTH_OUT="$(docker exec -e REDISCLI_AUTH="${REDIS_PASSWORD:-}" "$REDIS_CONTAINER" redis-cli ping 2>&1 || true)"
  if [[ "$REDIS_AUTH_OUT" == *"PONG"* ]]; then
    pass "redis autenticado responde PONG"
  else
    fail "redis autenticado responde PONG"
  fi
fi

if docker ps --format '{{.Names}}' | grep -qx "ucm-nginx"; then
  check_cmd "nginx -t" docker exec ucm-nginx nginx -t
  check_cmd "nginx reload" docker exec ucm-nginx nginx -s reload
else
  warn "container ucm-nginx nao encontrado (checagem nginx pulada)"
fi

if [[ "$TARGET_ENV" == "prod" ]]; then
  if [[ -d "$BACKUP_DIR" ]]; then
    RECENT_BACKUPS="$(find "$BACKUP_DIR" -maxdepth 1 -type f -mtime -7 | wc -l | tr -d ' ')"
    if [[ "${RECENT_BACKUPS:-0}" -gt 0 ]]; then
      pass "backup local recente encontrado em ${BACKUP_DIR}"
    else
      fail "backup local recente encontrado em ${BACKUP_DIR}"
    fi
  else
    fail "diretorio de backup existe (${BACKUP_DIR})"
  fi
fi

if [[ "$RUN_TESTS" == "1" ]]; then
  if [[ -f "${ROOT_DIR}/deploy/scripts/run-backend-all-tests.sh" ]]; then
    check_cmd "testes backend (unit/integration/acid)" bash "${ROOT_DIR}/deploy/scripts/run-backend-all-tests.sh"
  else
    fail "script run-backend-all-tests.sh existe"
  fi
fi

if [[ "$RUN_WHATSAPP_TEST" == "1" ]]; then
  WHATSAPP_RESPONSE="$(
    curl -k -sS -X POST "${BASE_URL%/}/api/v1/whatsapp/test" \
      -H "Content-Type: application/json" \
      -H "x-tenant-id: ${TENANT_ID}" \
      -d "{\"message\":\"quero 2 produto teste\",\"tenantId\":\"${TENANT_ID}\",\"phoneNumber\":\"${PHONE_NUMBER}\"}" || true
  )"
  if echo "$WHATSAPP_RESPONSE" | grep -q "PEDIDO PREPARADO"; then
    pass "whatsapp test retorna PEDIDO PREPARADO"
  else
    fail "whatsapp test retorna PEDIDO PREPARADO"
    echo "Resposta recebida: $WHATSAPP_RESPONSE"
  fi
fi

echo "========================================"
echo "Resumo Final"
echo "PASS: ${PASS_COUNT}"
echo "WARN: ${WARN_COUNT}"
echo "FAIL: ${FAIL_COUNT}"
echo "Relatorio: ${REPORT_FILE}"
echo "========================================"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
