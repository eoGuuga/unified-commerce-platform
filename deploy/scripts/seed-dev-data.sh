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
trap 'rm -f "$login_json" "$products_json"' EXIT

curl -sS -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Cache-Control: no-store" \
  -d "{\"email\":\"${DEV_EMAIL}\",\"password\":\"${DEV_PASSWORD}\"}" > "$login_json"

TOKEN="$(LOGIN_JSON="$login_json" python3 - <<'PY'
import json, os
data=json.load(open(os.environ["LOGIN_JSON"]))
print(data.get("access_token",""))
PY
)"

if [[ -z "$TOKEN" ]]; then
  echo "Falha ao obter token do dev user. Verifique SEED_DEV_USER e credenciais." >&2
  exit 1
fi

curl -sS -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "Cache-Control: no-store" \
  "${API_BASE}/products" > "$products_json"

PRODUCTS=(
  "Brigadeiro Gourmet Teste|10.50|50|5|Produto de teste seedado"
  "Produto Scan|10.50|50|5|Produto de teste seedado"
  "Barra de Chocolate|12.90|60|10|Produto de teste seedado"
  "Trufa Artesanal|8.90|80|10|Produto de teste seedado"
  "Caixa Presente|29.90|20|5|Produto de teste seedado"
)

for entry in "${PRODUCTS[@]}"; do
  IFS='|' read -r name price stock min_stock description <<< "$entry"

  existing_id="$(PRODUCTS_JSON="$products_json" PRODUCT_NAME="$name" python3 - <<'PY'
import json, os, sys
data=json.load(open(os.environ["PRODUCTS_JSON"]))
name=os.environ["PRODUCT_NAME"].strip().lower()
if isinstance(data, dict) and "data" in data:
  data=data["data"]
for item in data:
  if item.get("name","").strip().lower() == name:
    print(item.get("id",""))
    sys.exit(0)
print("")
PY
)"

  if [[ -z "$existing_id" ]]; then
    payload="$(NAME="$name" PRICE="$price" DESC="$description" python3 - <<'PY'
import os, json
print(json.dumps({
  "name": os.environ["NAME"],
  "price": float(os.environ["PRICE"]),
  "description": os.environ["DESC"],
  "unit": "unidade",
  "is_active": True
}))
PY
)"

    created="$(curl -sS -X POST "${API_BASE}/products" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "x-tenant-id: ${TENANT_ID}" \
      -H "Content-Type: application/json" \
      -d "$payload")"

    existing_id="$(CREATED_JSON="$created" python3 - <<'PY'
import json, os
data=json.loads(os.environ["CREATED_JSON"])
print(data.get("id",""))
PY
)"
  fi

  if [[ -z "$existing_id" ]]; then
    echo "Falha ao criar produto: ${name}" >&2
    exit 1
  fi

  curl -sS -X POST "${API_BASE}/products/${existing_id}/adjust-stock" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "Content-Type: application/json" \
    -d "{\"quantity\":${stock},\"reason\":\"seed\"}" >/dev/null

  curl -sS -X PATCH "${API_BASE}/products/${existing_id}/min-stock" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "Content-Type: application/json" \
    -d "{\"min_stock\":${min_stock}}" >/dev/null

  echo "Produto pronto: ${name}"
done

echo "Seed dev concluido."
