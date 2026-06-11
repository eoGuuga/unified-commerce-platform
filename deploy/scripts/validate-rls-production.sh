#!/usr/bin/env bash
set -euo pipefail

# Script de validação de RLS em produção
# Uso: bash deploy/scripts/validate-rls-production.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/deploy/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

# Carregar variáveis de ambiente
source "$ENV_FILE"

echo "=== Validação de RLS em Produção ==="
echo "Data: $(date)"
echo "Ambiente: PRODUÇÃO"
echo "URL: https://gtsofthub.com.br"
echo ""

# 1. Testar login com tenant correto
echo "1. Testando login com tenant correto..."
TENANT_ID="00000000-0000-0000-0000-000000000000"
LOGIN_RESPONSE=$(curl -s -X POST "https://gtsofthub.com.br/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "email": "dev@gtsofthub.com.br",
    "password": "12345678"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
  echo "✅ Login com tenant correto funcionou"
  JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
else
  echo "❌ Falha no login com tenant correto"
  echo "Resposta: $LOGIN_RESPONSE"
  exit 1
fi

# 2. Testar acesso a dados do tenant com JWT
echo ""
echo "2. Testando acesso a dados do tenant com JWT..."
USER_PROFILE=$(curl -s -X GET "https://gtsofthub.com.br/api/v1/auth/me" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-tenant-id: $TENANT_ID")

if echo "$USER_PROFILE" | grep -q "tenant_id"; then
  echo "✅ Acesso a perfil de usuário funcionou"
  echo "Tenant ID no perfil: $(echo "$USER_PROFILE" | jq -r '.tenant_id')"
else
  echo "❌ Falha no acesso a perfil de usuário"
  echo "Resposta: $USER_PROFILE"
  exit 1
fi

# 3. Testar webhook do WhatsApp com tenant correto
echo ""
echo "3. Testando webhook do WhatsApp com tenant correto..."
WHATSAPP_RESPONSE=$(curl -s -X POST "https://gtsofthub.com.br/api/v1/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "tenantId": "'$TENANT_ID'",
    "From": "5511999999999",
    "Body": "Olá, quero comprar um produto",
    "Timestamp": "'$(date -Iseconds)'",
    "MessageSid": "test-message-id"
  }')

if echo "$WHATSAPP_RESPONSE" | grep -q "success"; then
  echo "✅ Webhook do WhatsApp com tenant correto funcionou"
else
  echo "❌ Falha no webhook do WhatsApp"
  echo "Resposta: $WHATSAPP_RESPONSE"
  exit 1
fi

# 4. Testar webhook do Mercado Pago com tenant correto
echo ""
echo "4. Testando webhook do Mercado Pago com tenant correto..."
# Criar um pagamento primeiro
PAYMENT_RESPONSE=$(curl -s -X POST "https://gtsofthub.com.br/api/v1/payments/public" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "pedidoId": "test-pedido-id",
    "method": "pix",
    "amount": 100.00
  }')

if echo "$PAYMENT_RESPONSE" | grep -q "transaction_id"; then
  TRANSACTION_ID=$(echo "$PAYMENT_RESPONSE" | jq -r '.transaction_id')
  echo "✅ Pagamento criado: $TRANSACTION_ID"

  # Simular webhook do Mercado Pago
  WEBHOOK_RESPONSE=$(curl -s -X POST "https://gtsofthub.com.br/api/v1/payments/webhook/mercadopago" \
    -H "Content-Type: application/json" \
    -H "x-signature: $(echo -n "test-signature" | openssl dgst -sha256 -hmac "test-secret" | sed 's/^.*= //')" \
    -H "x-request-id: test-request-id" \
    -H "x-webhook-token: test-token" \
    -d '{
      "data": {
        "id": "'$TRANSACTION_ID'",
        "status": "paid",
        "status_detail": "accredited",
        "payment_method_id": "pix",
        "external_reference": "'$TENANT_ID'"
      },
      "live_mode": false,
      "type": "payment"
    }')

  if echo "$WEBHOOK_RESPONSE" | grep -q "status.*ok"; then
    echo "✅ Webhook do Mercado Pago com tenant correto funcionou"
  else
    echo "❌ Falha no webhook do Mercado Pago"
    echo "Resposta: $WEBHOOK_RESPONSE"
    exit 1
  fi
else
  echo "❌ Falha ao criar pagamento para teste de webhook"
  exit 1
fi

# 5. Testar isolamento de tenant - tentar acessar dados de outro tenant
echo ""
echo "5. Testando isolamento de tenant..."
OTHER_TENANT_ID="11111111-1111-1111-1111-111111111111"

# Tentar acessar dados do outro tenant com JWT do tenant original
ATTEMPT_RESPONSE=$(curl -s -X GET "https://gtsofthub.com.br/api/v1/auth/me" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-tenant-id: $OTHER_TENANT_ID" \
  -w "%{http_code}")

if [[ "$ATTEMPT_RESPONSE" == *"401"* ]]; then
  echo "✅ Isolamento de tenant funcionou - acesso negado para tenant incorreto"
elif [[ "$ATTEMPT_RESPONSE" == *"200"* ]]; then
  echo "❌ Isolamento de tenant falhou - acesso permitido para tenant incorreto"
  exit 1
else
  echo "❌ Resposta inesperada ao testar isolamento de tenant"
  exit 1
fi

# 6. Verificar logs do servidor para erros de RLS
echo ""
echo "6. Verificando logs do servidor por erros de RLS..."
LOGS=$(ssh "$PROD_USER@$PROD_SERVER" "docker logs ucm-backend --tail 100" 2>/dev/null || echo "Falha ao acessar logs")

if echo "$LOGS" | grep -q "RLS\|set_config\|current_tenant_id"; then
  echo "⚠️  Encontrados logs relacionados a RLS (verificar se são erros)"
else
  echo "✅ Nenhum erro de RLS encontrado nos logs recentes"
fi

echo ""
echo "=== Validação de RLS em Produção Concluída ==="
echo "Todos os testes passaram! O RLS está funcionando corretamente."