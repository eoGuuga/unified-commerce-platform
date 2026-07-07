#!/usr/bin/env bash
set -uo pipefail

# UCM Watchdog — healthcheck + auto-recovery + alerta Telegram.
# Roda a cada 60s via ucm-watchdog.timer (systemd). VERSIONADO no repo; a unit
# em deploy/systemd/ aponta pra este arquivo. Install documentado abaixo.
#
# Path DERIVADO do local do script (segue o deploy) — nao usar path absoluto
# fixo: foi o /opt/ucm hardcoded que matou a versao anterior na faxina.
#
# Modo teste (WATCHDOG_TEST=1): simula um "down" e exercita deteccao + alerta
# SEM tocar containers e SEM gravar estado — valida o canal sem downtime.
#
# Install (no servidor, requer root):
#   sudo install -m 644 deploy/systemd/ucm-watchdog.service /etc/systemd/system/
#   sudo install -m 644 deploy/systemd/ucm-watchdog.timer   /etc/systemd/system/
#   sudo systemctl daemon-reload && sudo systemctl enable --now ucm-watchdog.timer

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_DIR="${REPO_ROOT}/deploy"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT="deploy"
NOTIFY="${SCRIPT_DIR}/notify-telegram.sh"
LOG="/var/log/ucm-watchdog.log"
STATE="/var/lib/ucm-watchdog.state"
CONTAINERS="ucm-nginx ucm-backend ucm-frontend ucm-postgres ucm-redis"
TEST="${WATCHDOG_TEST:-0}"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { echo "$(ts) $*" >> "$LOG" 2>/dev/null || true; }

# Envia no Telegram lendo SO as 2 vars do .env (valor nunca ecoado).
notify() {
  [ -f "$ENV_FILE" ] || { log "WARN notify_skipped_no_env"; return 0; }
  local tok chat
  tok="$(grep '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
  chat="$(grep '^TELEGRAM_CHAT_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
  [ -n "$tok" ] && [ -n "$chat" ] || { log "WARN notify_skipped_no_telegram_config"; return 0; }
  TELEGRAM_BOT_TOKEN="$tok" TELEGRAM_CHAT_ID="$chat" bash "$NOTIFY" "$1" || log "WARN notify_send_failed"
}

# --- Deteccao (nao derruba nada; so observa) ---
problems=""
for c in $CONTAINERS; do
  st="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo MISSING)"
  [ "$st" = "running" ] || problems="${problems} container:${c}=${st}"
done
curl -fsS --max-time 5 http://localhost/api/v1/health/ready >/dev/null 2>&1 || problems="${problems} api_ready=fail"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost/ || true)"
[ "$code" = "200" ] || [ "$code" = "304" ] || problems="${problems} frontend=http_${code}"

# Modo teste: simula um down (nao toca container, nao grava estado)
if [ "$TEST" = "1" ]; then
  problems=" [TESTE] container:ucm-backend=simulado (nenhum container real tocado)"
fi

prev="$(cat "$STATE" 2>/dev/null || echo ok)"
[ "$TEST" = "1" ] && prev="ok"   # em teste, forca a transicao p/ sempre alertar

if [ -n "$problems" ]; then
  curr="down"
  log "DOWN detected:${problems}"
  if [ "$TEST" = "1" ]; then
    recovered="DRY-RUN (modo teste — recovery NAO executado)"
    log "TEST mode: pulei o recovery real (docker compose up / restart)"
  else
    log "ACTION recovery_start"
    ( cd "$DEPLOY_DIR" && docker compose -p "$PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d ) >>"$LOG" 2>&1 || true
    docker restart ucm-backend ucm-frontend ucm-nginx >>"$LOG" 2>&1 || true
    sleep 3
    if curl -fsS --max-time 5 http://localhost/api/v1/health/ready >/dev/null 2>&1; then
      recovered="recuperei (api ready)"; curr="ok"; log "OK recovery_api_ready"
    else
      recovered="AINDA DOWN apos recovery"; log "ERROR recovery_api_still_down"
    fi
  fi
  # Alerta SO na transicao ok->down (evita spam a cada 60s enquanto estiver down).
  [ "$prev" = "ok" ] && notify "🔴 [GTSoftHub watchdog] caiu:${problems}. Recovery: ${recovered}."
else
  curr="ok"
  log "OK all_good"
  [ "$prev" = "down" ] && notify "✅ [GTSoftHub watchdog] recuperado — tudo OK de novo."
fi

# Persiste o estado (menos em teste, pra nao poluir a transicao).
if [ "$TEST" != "1" ]; then
  mkdir -p "$(dirname "$STATE")" 2>/dev/null || true
  echo "$curr" > "$STATE" 2>/dev/null || true
fi
