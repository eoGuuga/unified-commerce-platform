#!/usr/bin/env bash
set -uo pipefail

# Alerta de erro de APLICACAO (Tier 1-lite): varre o log do backend por
# "level":"error" (JSON) na janela recente e avisa no Telegram (mesmo bot do
# watchdog). Cron */5 + janela 6m (1min de sobreposicao -> nunca perde; duplicar
# um raro erro de borda e melhor que perder). Reusa notify-telegram.sh.
# docker logs = READ-ONLY: nao toca app/DB/container.
#
# Calibrado no formato REAL do log (JSON estruturado). Os 4xx sao "level":"warn"
# (uso normal: 404/401/400/429) -> ignorados automaticamente ao mirar so "error".
#
# Seguranca do conteudo do alerta: extrai SO os campos context+message (nao
# stack/data/outros), e TRUNCA cada linha a MAXLEN chars -> reduz o risco de um
# dado sensivel que por acaso caia numa message vazar pro Telegram.
#
# Modos:
#   APP_ALERT_WINDOW=6m   janela do docker logs --since (default 6m)
#   APP_ALERT_DRYRUN=1    imprime a mensagem em vez de enviar (teste)
#   APP_ALERT_MAXLEN=200  truncamento por linha (default 200)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/deploy/.env"
NOTIFY="${SCRIPT_DIR}/notify-telegram.sh"
CONTAINER="${APP_CONTAINER:-ucm-backend}"
WINDOW="${APP_ALERT_WINDOW:-6m}"
MAXLEN="${APP_ALERT_MAXLEN:-200}"

# SO "level":"error". 4xx = "level":"warn" -> fora. debug/info -> fora.
errors="$(docker logs "$CONTAINER" --since "$WINDOW" 2>&1 | grep '"level":"error"' || true)"
n="$(printf '%s\n' "$errors" | grep -c '"level":"error"' || true)"
[ "${n:-0}" -eq 0 ] && exit 0   # nada a alertar -> silencio (sem spam quando limpo)

# Anti-flood + sanitizacao: extrai SO context+message (nao stack/data), agrupa
# iguais (sem o timestamp) com contagem, e trunca cada linha a MAXLEN chars.
distinct="$(printf '%s\n' "$errors" \
  | sed -E 's/"timestamp":"[^"]*",//' \
  | grep -oE '"context":"[^"]*","message":"[^"]*"' \
  | sort | uniq -c | sort -rn | head -6 \
  | cut -c1-"${MAXLEN}")"

msg="🔴 [GTSoftHub app] ${n} erro(s) no backend (janela ${WINDOW}):
${distinct}"

if [ "${APP_ALERT_DRYRUN:-0}" = "1" ]; then
  printf '%s\n' "$msg"
  exit 0
fi

# Envia (le SO as 2 vars do .env; valor nunca ecoado nem em argv).
tok="$(grep '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
chat="$(grep '^TELEGRAM_CHAT_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
[ -n "$tok" ] && [ -n "$chat" ] && TELEGRAM_BOT_TOKEN="$tok" TELEGRAM_CHAT_ID="$chat" bash "$NOTIFY" "$msg"
