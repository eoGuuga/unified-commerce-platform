#!/usr/bin/env bash
set -euo pipefail

# Envia alerta via Telegram (gratuito).
# Requer no ambiente (ex.: deploy/.env):
#   TELEGRAM_BOT_TOKEN=...
#   TELEGRAM_CHAT_ID=...
#
# Uso:
#   set -a; source /opt/ucm/deploy/.env; set +a
#   bash deploy/scripts/notify-telegram.sh "mensagem"

msg="${1:-UCM alert}"
token="${TELEGRAM_BOT_TOKEN:-}"
chat="${TELEGRAM_CHAT_ID:-}"

if [[ -z "$token" || -z "$chat" ]]; then
  # Sem config -> não falhar (script opcional)
  exit 0
fi

curl -fsS --max-time 10 \
  -X POST "https://api.telegram.org/bot${token}/sendMessage" \
  -d "chat_id=${chat}" \
  --data-urlencode "text=${msg}" >/dev/null

