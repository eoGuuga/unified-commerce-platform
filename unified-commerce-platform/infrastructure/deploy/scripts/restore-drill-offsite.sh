#!/usr/bin/env bash
set -euo pipefail

# Restore drill offsite (mensal): valida que o backup no B2 é restaurável.
# Em caso de falha, envia alerta no Telegram (se configurado).
#
# Variáveis (ex.: deploy/env.prod):
#   REMOTE=b2crypt:
#   TELEGRAM_BOT_TOKEN=...
#   TELEGRAM_CHAT_ID=...
#
# Uso:
#   set -a; source /opt/ucm/deploy/env.prod; set +a
#   bash deploy/scripts/restore-drill-offsite.sh

REMOTE="${REMOTE:-b2crypt:}"
WORKDIR="/tmp/ucm-restore-drill"
LOG="/var/log/ucm-restore-drill.log"
CONTAINER="ucm-postgres-restore-drill"

mkdir -p "$WORKDIR"
touch "$LOG"
chmod 600 "$LOG" || true

log() { echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) $* ===" >> "$LOG"; }

cleanup() {
  docker rm -f "$CONTAINER" >> "$LOG" 2>&1 || true
  rm -rf "$WORKDIR" >> "$LOG" 2>&1 || true
}

fail() {
  log "ERROR $*"
  # Alerta opcional (se TELEGRAM_* existir)
  bash "$(dirname "$0")/notify-telegram.sh" \
    "🚨 RESTORE DRILL FALHOU (gtsofthub) — veja /var/log/ucm-restore-drill.log" || true
  cleanup
  exit 1
}

trap 'fail "trap_err (linha $LINENO)"' ERR

log "start"

LATEST="$(rclone lsf "$REMOTE" --files-only --include 'ucm-*.sql.gz' | sort | tail -n 1 || true)"
[[ -n "${LATEST}" ]] || fail "no_backups_found"
log "latest=${LATEST}"

rm -f "$WORKDIR/"ucm-*.sql.gz 2>/dev/null || true
rclone copy "$REMOTE${LATEST}" "$WORKDIR/" >> "$LOG" 2>&1
[[ -f "$WORKDIR/$LATEST" ]] || fail "download_failed"

docker rm -f "$CONTAINER" >> "$LOG" 2>&1 || true
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=restore -e POSTGRES_DB=ucm_restore postgres:15-alpine >> "$LOG" 2>&1

for i in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -d ucm_restore >> "$LOG" 2>&1 && break
  sleep 1
done

# Dump não inclui roles -> criar role referenciada
docker exec -i "$CONTAINER" psql -U postgres -d ucm_restore -v ON_ERROR_STOP=1 >> "$LOG" 2>&1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ucm_app') THEN
    CREATE ROLE ucm_app LOGIN PASSWORD 'restore';
  END IF;
END $$;
SQL

gunzip -c "$WORKDIR/$LATEST" | docker exec -i "$CONTAINER" psql -U postgres -d ucm_restore -v ON_ERROR_STOP=1 >> "$LOG" 2>&1

tenants="$(docker exec -i "$CONTAINER" psql -U postgres -d ucm_restore -Atc "select count(*) from tenants;" | tr -d '\r\n' || true)"
usuarios="$(docker exec -i "$CONTAINER" psql -U postgres -d ucm_restore -Atc "select count(*) from usuarios;" | tr -d '\r\n' || true)"
produtos="$(docker exec -i "$CONTAINER" psql -U postgres -d ucm_restore -Atc "select count(*) from produtos;" | tr -d '\r\n' || true)"

log "counts tenants=${tenants} usuarios=${usuarios} produtos=${produtos}"

[[ "${tenants}" -ge 1 && "${usuarios}" -ge 1 ]] || fail "sanity_failed"

cleanup
log "OK"

