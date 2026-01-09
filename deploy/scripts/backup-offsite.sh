#!/usr/bin/env bash
set -euo pipefail

# Backup offsite (B2 via rclone).
# Recomendado usar um remote criptografado (ex.: b2crypt:) para armazenar backups cifrados no bucket.
#
# Variáveis (ex.: deploy/env.prod):
#   BACKUP_DIR=/opt/ucm/backups
#   REMOTE=b2crypt:
#   OFFSITE_KEEP_DAYS=30
#
# Uso:
#   set -a; source /opt/ucm/deploy/env.prod; set +a
#   bash deploy/scripts/backup-offsite.sh

BACKUP_DIR="${BACKUP_DIR:-/opt/ucm/backups}"
REMOTE="${REMOTE:-b2crypt:}"
OFFSITE_KEEP_DAYS="${OFFSITE_KEEP_DAYS:-30}"
LOG="${OFFSITE_LOG:-/var/log/ucm-backup-offsite.log}"

mkdir -p "$(dirname "$LOG")"
touch "$LOG"
chmod 600 "$LOG" || true

echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) offsite start ===" >> "$LOG"

# Sobe apenas backups do Postgres gerados pelo backup-postgres.sh
rclone copy "$BACKUP_DIR" "$REMOTE" \
  --include "ucm-*.sql.gz" \
  --ignore-existing \
  --transfers 2 --checkers 4 \
  --log-level INFO >> "$LOG" 2>&1

# Retenção no destino (apaga antigos)
rclone delete "$REMOTE" \
  --include "ucm-*.sql.gz" \
  --min-age "${OFFSITE_KEEP_DAYS}d" \
  --rmdirs \
  --log-level INFO >> "$LOG" 2>&1 || true

echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) offsite end ===" >> "$LOG"

