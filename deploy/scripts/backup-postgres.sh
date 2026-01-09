#!/usr/bin/env bash
set -euo pipefail

# Backup simples (pg_dump) com rotacao
# Uso recomendado via cron (diario):
#   0 3 * * * cd /opt/ucm && bash deploy/scripts/backup-postgres.sh

BACKUP_DIR="${BACKUP_DIR:-/opt/ucm/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "${BACKUP_DIR}"

ts="$(date +%Y%m%d-%H%M%S)"
file="${BACKUP_DIR}/ucm-${ts}.sql.gz"

echo "Gerando backup: ${file}"
docker exec -i ucm-postgres pg_dump -U postgres -d ucm | gzip > "${file}"

echo "Rotacionando (>${KEEP_DAYS} dias)..."
find "${BACKUP_DIR}" -type f -name "ucm-*.sql.gz" -mtime "+${KEEP_DAYS}" -delete || true

echo "OK"

