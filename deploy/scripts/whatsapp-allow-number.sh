#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# whatsapp-allow-number.sh
#
# Adiciona (idempotente) um numero a allowlist de WhatsApp de UM tenant
# (`tenants.settings.whatsappNumbers`). O webhook so ACEITA mensagens de
# numeros nessa lista (ver `validateWhatsAppNumber` em tenants.service.ts) —
# em producao, lista vazia => bloqueia tudo (fail-closed).
#
# NAO mexe no codigo do bot. E dado/config.
#
# Uso (no servidor, ou onde o Postgres esteja acessivel via docker):
#   TENANT_ID=<uuid> PHONE=<numero> bash whatsapp-allow-number.sh
#   ou:  bash whatsapp-allow-number.sh <tenant_id> <phone>
#
# Overrides opcionais: DB_NAME (default ucm), PG_CONTAINER (default ucm-postgres).
#
# ---------------------------------------------------------------------------
# TODO — DIA DA CONEXAO (Fase 1 do bot, WhatsApp Cloud API):
#   PHONE     = o numero do celular do DONO, o mesmo que ele cadastrar como
#               "destinatario de teste" no painel da Meta (ex.: 5511999998888).
#   TENANT_ID = a doceria "Loucas por Brigadeiro"
#               (2675a300-1f03-4c74-b462-99754fd70eb2).
# O casamento e por numero normalizado OU ultimos 9/11 digitos
# (matchesConfiguredPhone), entao qualquer formato razoavel serve.
#
# ⚠️ Fase 2: essa allowlist de REMETENTE nao escala pra clientes reais
#   (um bot nao pre-cadastra cada comprador). Repensar o gate quando abrir
#   o bot pro publico.
# ============================================================================

TENANT_ID="${1:-${TENANT_ID:-}}"
PHONE="${2:-${PHONE:-}}"
DB="${DB_NAME:-ucm}"
CONTAINER="${PG_CONTAINER:-ucm-postgres}"

if [ -z "$TENANT_ID" ]; then
  echo "ERRO: informe TENANT_ID (uuid do tenant). Ex.: TENANT_ID=2675a300-... PHONE=5511999998888 bash $0" >&2
  exit 1
fi
if [ -z "$PHONE" ]; then
  echo "ERRO: informe PHONE (numero, ex.: 5511999998888)." >&2
  exit 1
fi

# So digitos (o backend normaliza, mas guardamos limpo).
PHONE_DIGITS="$(printf '%s' "$PHONE" | tr -cd '0-9')"
if [ -z "$PHONE_DIGITS" ]; then
  echo "ERRO: PHONE nao tem digitos validos." >&2
  exit 1
fi

echo "==> Adicionando ${PHONE_DIGITS} a whatsappNumbers do tenant ${TENANT_ID} (db ${DB}, container ${CONTAINER})"

# Rodado como superuser (postgres) via socket local (trust) — bypassa RLS,
# como as demais tarefas de manutencao. Idempotente: jsonb_agg(DISTINCT ...).
docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 \
  -v tenant="$TENANT_ID" -v phone="$PHONE_DIGITS" <<'SQL'
UPDATE tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{whatsappNumbers}',
  (
    SELECT jsonb_agg(DISTINCT elem)
    FROM jsonb_array_elements(
      COALESCE(settings -> 'whatsappNumbers', '[]'::jsonb)
      || jsonb_build_array(:'phone'::text)
    ) AS elem
  )
)
WHERE id = :'tenant'::uuid;

-- Conferencia (mostra a lista resultante).
SELECT id, settings -> 'whatsappNumbers' AS whatsapp_numbers
FROM tenants
WHERE id = :'tenant'::uuid;
SQL

echo "==> Feito. Rodar de novo com o mesmo numero NAO duplica (idempotente)."
