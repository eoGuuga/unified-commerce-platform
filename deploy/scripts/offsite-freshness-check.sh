#!/usr/bin/env bash
# DEAD-MAN'S SWITCH do off-site (Ciclo 2A). Grita se o off-site parou de subir —
# incluindo o caso em que NÃO dá pra saber (fail-closed: quem não sabe, grita).
#
# TRÊS estados (o desenho de 2 estados tinha um buraco: consulta que falha/volta
# vazia "não é > limiar", então passava batido — off-site morto, vigia calado):
#   FRESCO   (último upload < LIMIAR)                 -> silêncio, exit 0
#   VELHO    (último upload > LIMIAR)                 -> alerta "atrasado", exit 1
#   NÃO-SEI  (rclone rc!=0 / lista vazia / ts ruim)   -> alerta "desconhecido", exit 1
#
# Vigia o DESTINO (rclone lsf no B2), não o processo vigiado — e roda em cron
# PRÓPRIO e independente (deploy/cron/gtsofthub-offsite-freshness): se o off-site
# morrer, ESTE continua vivo e grita. Anti-flood: no máx. 1 alerta/dia.
#
# ⚠️ 2B verifica o formato de modtime do rclone REAL (aqui provado por fake-rclone).
set -uo pipefail   # sem `set -e`: capturamos o rc do rclone em vez de abortar.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${REMOTE:-b2crypt:}"
THRESHOLD_HOURS="${OFFSITE_MAX_AGE_HOURS:-30}"
LOG="${FRESHNESS_LOG:-/var/log/ucm-offsite-freshness.log}"
STATE_FILE="${FRESHNESS_STATE:-/var/lib/ucm/offsite-freshness.last}"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/deploy/.env}"
NOTIFY="${FRESHNESS_NOTIFY:-${SCRIPT_DIR}/notify-telegram.sh}"

mkdir -p "$(dirname "$LOG")" "$(dirname "$STATE_FILE")" 2>/dev/null || true
touch "$LOG" 2>/dev/null || true
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

# Envia o alerta (sem PII — só idade/estado), com anti-flood de 1/dia. Lê SÓ as 2
# vars do Telegram por grep (nunca ecoa o valor) — mesmo padrão do app-alert.sh.
send_alert() {
  log "ALERT: $1"
  local today last tok chat
  today="$(date -u +%Y-%m-%d)"
  last="$(cat "$STATE_FILE" 2>/dev/null || true)"
  if [ "$last" = "$today" ]; then
    log "anti-flood: já alertou hoje ($today) — suprimindo o envio"
    return 0
  fi
  tok="$(grep '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r')"
  chat="$(grep '^TELEGRAM_CHAT_ID=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r')"
  if [ -n "$tok" ] && [ -n "$chat" ]; then
    TELEGRAM_BOT_TOKEN="$tok" TELEGRAM_CHAT_ID="$chat" bash "$NOTIFY" "$1" >> "$LOG" 2>&1 \
      && log "alerta enviado" || log "falha ao enviar alerta (canal)"
  else
    log "TELEGRAM_* ausente no .env — alerta só no log"
  fi
  echo "$today" > "$STATE_FILE" 2>/dev/null || true
}

log "check start (remote=${REMOTE}, limiar=${THRESHOLD_HOURS}h)"

# Consulta o DESTINO. Captura rc E saída separadamente (fail-closed em cada falha).
out="$(rclone lsf "$REMOTE" --files-only --include 'ucm-*.sql.gz' --format 'tp' --separator '|' 2>>"$LOG")"
rc=$?

# ESTADO NÃO-SEI (a): rclone falhou (auth/rede/remote errado).
if [ "$rc" -ne 0 ]; then
  send_alert "🚨 OFF-SITE: não consegui consultar o B2 (rclone rc=${rc}). Estado desconhecido — verifica credencial/rede/remote."
  exit 1
fi

# ESTADO NÃO-SEI (b): consulta OK mas nenhum backup listado.
if [ -z "$out" ]; then
  send_alert "🚨 OFF-SITE: nenhum backup ucm-*.sql.gz no B2 (lista vazia). Estado desconhecido — verifica se o upload está rodando."
  exit 1
fi

# Mais recente: formato 'tp' = tempo|path; o tempo (ISO-ish) ordena cronologicamente.
newest="$(printf '%s\n' "$out" | sort | tail -1)"
mod="${newest%%|*}"
epoch_file="$(date -d "$mod" +%s 2>/dev/null || true)"

# ESTADO NÃO-SEI (c): timestamp não-parseável.
if ! [[ "$epoch_file" =~ ^[0-9]+$ ]]; then
  send_alert "🚨 OFF-SITE: timestamp do último backup ilegível ('${mod}'). Estado desconhecido."
  exit 1
fi

age_h=$(( ( $(date +%s) - epoch_file ) / 3600 ))
log "último upload no B2: idade ${age_h}h (limiar ${THRESHOLD_HOURS}h)"

# ESTADO VELHO.
if [ "$age_h" -gt "$THRESHOLD_HOURS" ]; then
  send_alert "🚨 OFF-SITE ATRASADO: último backup no B2 tem ${age_h}h (limiar ${THRESHOLD_HOURS}h). Verifica o cron do off-site."
  exit 1
fi

# ESTADO FRESCO.
log "OK: off-site fresco (${age_h}h)"
exit 0
