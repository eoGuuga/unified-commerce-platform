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

BASE_URL="${FRONTEND_URL:-https://dev.gtsofthub.com.br}"
API_BASE="${BASE_URL%/}/api/v1"
TENANT_ID="${DEV_TENANT_ID:-00000000-0000-0000-0000-000000000000}"
DEV_EMAIL="${DEV_USER_EMAIL:-dev@gtsofthub.com.br}"
DEV_PASSWORD="${DEV_USER_PASSWORD:-12345678}"

login_json="$(mktemp)"
products_json="$(mktemp)"
orders_json="$(mktemp)"
me_json="$(mktemp)"
trap 'rm -f "$login_json" "$products_json" "$orders_json" "$me_json"' EXIT

echo "-> health"
curl -fsS "${API_BASE}/health" >/dev/null

echo "-> login"
curl -sS -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Cache-Control: no-store" \
  -d "{\"email\":\"${DEV_EMAIL}\",\"password\":\"${DEV_PASSWORD}\"}" > "$login_json"

TOKEN="$(python3 - <<'PY'
import json
data=json.load(open("'$login_json'"))
print(data.get("access_token",""))
PY
)"

if [[ -z "$TOKEN" ]]; then
  echo "Falha no login dev. Verifique seed e credenciais." >&2
  cat "$login_json" >&2
  exit 1
fi

echo "-> auth/me"
curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-tenant-id: ${TENANT_ID}" \
  -H "Cache-Control: no-store" "${API_BASE}/auth/me" > "$me_json"

python3 - <<'PY'
import json, sys
data=json.load(open("'$me_json'"))
if "id" not in data:
  print("auth/me invalido", data)
  sys.exit(1)
PY

echo "-> products"
curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-tenant-id: ${TENANT_ID}" \
  -H "Cache-Control: no-store" "${API_BASE}/products" > "$products_json"

python3 - <<'PY'
import json, sys
data=json.load(open("'$products_json'"))
if isinstance(data, dict) and "data" in data:
  data=data["data"]
if not isinstance(data, list):
  print("products retorno invalido", data)
  sys.exit(1)
PY

echo "-> orders (list)"
curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-tenant-id: ${TENANT_ID}" \
  -H "Cache-Control: no-store" "${API_BASE}/orders" > "$orders_json"

python3 - <<'PY'
import json, sys
data=json.load(open("'$orders_json'"))
if isinstance(data, dict) and "data" in data:
  data=data["data"]
if not isinstance(data, list):
  print("orders retorno invalido", data)
  sys.exit(1)
PY

echo "Smoke OK."
