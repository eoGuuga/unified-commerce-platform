#!/usr/bin/env bash
set -euo pipefail

# E2E do fluxo WhatsApp no ambiente dev/test.
# Uso: bash deploy/scripts/run-dev-whatsapp-e2e.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

BASE_URL="${DEV_API_BASE_URL:-${FRONTEND_URL:-https://dev.gtsofthub.com.br}}"
API_BASE="${BASE_URL%/}/api/v1"
TENANT_ID="${DEV_TENANT_ID:-00000000-0000-0000-0000-000000000000}"

wait_for_health() {
  local max_attempts=20
  local attempt=1
  while (( attempt <= max_attempts )); do
    if curl -fsS "${API_BASE}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  return 1
}

if ! wait_for_health; then
  for fallback in "http://127.0.0.1:8080" "http://localhost:8080"; do
    API_BASE="${fallback%/}/api/v1"
    if wait_for_health; then
      echo "Usando API local: ${API_BASE}"
      break
    fi
  done
fi

if ! curl -fsS "${API_BASE}/health" >/dev/null 2>&1; then
  echo "Health check falhou: ${API_BASE}/health" >&2
  exit 1
fi

send_msg() {
  local msg="$1"
  local out
  local expect
  local label
  out="$(mktemp)"
  expect="$2"
  label="$3"

  payload="$(MSG="$msg" TENANT_ID="$TENANT_ID" python3 - <<'PY'
import json, os
print(json.dumps({
  "message": os.environ.get("MSG", ""),
  "tenantId": os.environ.get("TENANT_ID", "")
}))
PY
)"

  curl -sS -X POST "${API_BASE}/whatsapp/test" \
    -H "Content-Type: application/json" \
    -d "$payload" > "$out"

  OUT_FILE="$out" EXPECT="$expect" LABEL="$label" python3 - <<'PY'
import json, os, sys, unicodedata
out_file = os.environ.get('OUT_FILE')
expected = os.environ.get('EXPECT')
label = os.environ.get('LABEL')

with open(out_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

if not data.get('success'):
    print(f"Falha no passo {label}: {data}")
    sys.exit(1)

response = data.get('response', '')

norm = unicodedata.normalize('NFD', response)
norm = ''.join(ch for ch in norm if unicodedata.category(ch) != 'Mn').lower()
exp = unicodedata.normalize('NFD', expected)
exp = ''.join(ch for ch in exp if unicodedata.category(ch) != 'Mn').lower()

if exp not in norm:
    print(f"Resposta inesperada no passo {label}. Esperado: {expected}")
    print(response)
    sys.exit(1)
PY

  rm -f "$out"
}

send_msg "quero 5 brigadeiros" "nome completo" "inicio"
send_msg "Joao da Silva" "Digite \"1\" para entrega" "nome"
send_msg "1" "endereco completo" "entrega"
send_msg "Rua das Flores, 123, Apto 45, Centro, Sao Paulo, SP, 01234-567" "telefone de contato" "endereco"
send_msg "11987654321" "CONFIRMAC" "telefone"
send_msg "sim" "PEDIDO CRIADO COM SUCESSO" "confirmacao"
send_msg "pix" "PAGAMENTO PIX" "pix"

echo "WhatsApp E2E OK."
