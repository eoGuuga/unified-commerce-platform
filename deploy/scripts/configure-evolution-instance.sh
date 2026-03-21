#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_ENV_FILE="${ROOT_DIR}/deploy/.env"
EVOLUTION_ENV_FILE="${ROOT_DIR}/deploy/evolution.test.env"
EVOLUTION_ADMIN_URL="${EVOLUTION_ADMIN_URL:-http://127.0.0.1:8081}"
TENANT_ID="${TENANT_ID:-}"

if [[ ! -f "$APP_ENV_FILE" ]]; then
  echo "Arquivo nao encontrado: $APP_ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$EVOLUTION_ENV_FILE" ]]; then
  echo "Arquivo nao encontrado: $EVOLUTION_ENV_FILE" >&2
  echo "Copie deploy/evolution.test.env.example para deploy/evolution.test.env antes de continuar." >&2
  exit 1
fi

set -a
source "$APP_ENV_FILE"
source "$EVOLUTION_ENV_FILE"
set +a

TENANT_ID="${TENANT_ID:-${DEV_TENANT_ID:-00000000-0000-0000-0000-000000000000}}"
INSTANCE_NAME="${EVOLUTION_INSTANCE:-loucas-teste}"
WEBHOOK_URL="${WHATSAPP_WEBHOOK_URL:-${FRONTEND_URL%/}/api/v1/whatsapp/webhook?tenantId=${TENANT_ID}}"
TEST_NUMBER="${EVOLUTION_TEST_PHONE:-}"

if [[ -z "${AUTHENTICATION_API_KEY:-}" ]]; then
  echo "AUTHENTICATION_API_KEY nao configurada em deploy/evolution.test.env" >&2
  exit 1
fi

CREATE_PAYLOAD=$(cat <<JSON
{
  "instanceName": "${INSTANCE_NAME}",
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true,
  "webhook": "${WEBHOOK_URL}",
  "webhook_by_events": false,
  "events": [
    "QRCODE_UPDATED",
    "MESSAGES_UPSERT",
    "CONNECTION_UPDATE"
  ]$(if [[ -n "$TEST_NUMBER" ]]; then printf ',\n  "number": "%s"' "$TEST_NUMBER"; fi)
}
JSON
)

echo "==> Criando ou reaproveitando instancia ${INSTANCE_NAME}"
if ! curl -fsS \
  --request POST \
  --url "${EVOLUTION_ADMIN_URL}/instance/create" \
  --header "Content-Type: application/json" \
  --header "apikey: ${AUTHENTICATION_API_KEY}" \
  --data "$CREATE_PAYLOAD"; then
  echo ""
  echo "Aviso: a criacao da instancia falhou ou ela ja existe. Vou tentar reconfigurar o webhook mesmo assim."
fi

echo ""
echo "==> Configurando webhook da instancia ${INSTANCE_NAME}"
curl -fsS \
  --request POST \
  --url "${EVOLUTION_ADMIN_URL}/webhook/set/${INSTANCE_NAME}" \
  --header "Content-Type: application/json" \
  --header "apikey: ${AUTHENTICATION_API_KEY}" \
  --data "{
    \"enabled\": true,
    \"url\": \"${WEBHOOK_URL}\",
    \"events\": [\"QRCODE_UPDATED\", \"MESSAGES_UPSERT\", \"CONNECTION_UPDATE\"],
    \"webhook_by_events\": false,
    \"webhook_base64\": false
  }"

echo ""
echo "==> Webhook atual"
curl -fsS \
  --request GET \
  --url "${EVOLUTION_ADMIN_URL}/webhook/find/${INSTANCE_NAME}" \
  --header "apikey: ${AUTHENTICATION_API_KEY}"

echo ""
echo "Instancia configurada."
echo "Webhook: ${WEBHOOK_URL}"
echo "Manager local do VPS: ${EVOLUTION_ADMIN_URL}/manager"
echo "Se voce estiver conectado por SSH, abra um tunel local para acessar o manager e escanear o QR."
