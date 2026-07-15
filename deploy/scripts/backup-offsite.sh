#!/usr/bin/env bash
set -euo pipefail

# Backup offsite (B2 via rclone).
# Recomendado usar um remote criptografado (ex.: b2crypt:) para armazenar backups cifrados no bucket.
# REMOTE vem do .env (sem nome de remote hardcoded) — troca plain->crypt é só env.
#
# Variáveis (ex.: deploy/.env):
#   BACKUP_DIR=<derivado do script por padrão; override por env se necessário>
#   REMOTE=b2crypt:
#   OFFSITE_KEEP_DAYS=30
#
# Uso:
#   set -a; source /opt/gtsofthub/deploy/.env; set +a
#   bash deploy/scripts/backup-offsite.sh

# BACKUP_DIR é DERIVADO do local deste script (segue o deploy onde quer que ele
# esteja) — mesmo padrão do backup-postgres.sh (commit 1c9e4d5). O /opt/ucm
# hardcoded de antes apontava pra um diretório que a faxina de path removeu.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
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

# Retenção no destino (apaga antigos). FALHA ALTO: o `|| true` de antes engolia
# erros de poda em silêncio — foi assim que 121 arquivos (~4 meses) acumularam
# apesar do OFFSITE_KEEP_DAYS. O `copy` acima JÁ garantiu o backup off-site; se
# só a poda falhar, gritamos (log + exit != 0) pra ser visível no cron/monitor,
# sem esconder. (O dead-man's switch vigia a FRESCURA do destino à parte, então
# uma falha só-de-poda não gera falso alarme de "backup sumiu".)
if ! rclone delete "$REMOTE" \
  --include "ucm-*.sql.gz" \
  --min-age "${OFFSITE_KEEP_DAYS}d" \
  --rmdirs \
  --log-level INFO >> "$LOG" 2>&1; then
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) offsite ERROR: retention prune failed (min-age ${OFFSITE_KEEP_DAYS}d) ===" >> "$LOG"
  exit 1
fi

echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) offsite end ===" >> "$LOG"

