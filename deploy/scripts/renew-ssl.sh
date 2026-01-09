#!/usr/bin/env bash
set -euo pipefail

# Renovar certificados SSL e recarregar Nginx
# Uso recomendado via cron (diário às 3:30 AM):
#   30 3 * * * /opt/ucm/deploy/scripts/renew-ssl.sh >> /var/log/ucm-ssl-renew.log 2>&1

LOG="/var/log/ucm-ssl-renew.log"
mkdir -p "$(dirname "$LOG")"
touch "$LOG"
chmod 600 "$LOG" || true

log() {
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) $* ===" >> "$LOG"
}

log "start"

# Renovar certificados (modo quieto)
certbot renew --quiet >> "$LOG" 2>&1

# Se renovação foi bem-sucedida, recarregar Nginx
if [ $? -eq 0 ]; then
  log "renewal_success"
  # Recarregar Nginx para aplicar novos certificados
  docker exec ucm-nginx nginx -s reload >> "$LOG" 2>&1 || {
    log "nginx_reload_failed"
    exit 1
  }
  log "nginx_reloaded"
else
  log "renewal_failed_or_no_action_needed"
fi

log "end"
