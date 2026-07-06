#!/usr/bin/env bash
set -euo pipefail

# Backup (pg_dump) do Postgres de prod, com rotacao.
# Uso via cron (diario) — ver deploy/cron/gtsofthub-backup:
#   0 6 * * * cd /opt/gtsofthub && bash deploy/scripts/backup-postgres.sh >> backups/backup.log 2>&1
#
# BACKUP_DIR e derivado do local DESTE script (segue o deploy onde quer que ele
# esteja) — nao usar path absoluto fixo: foi o que quebrou na mudanca de
# /opt/ucm -> /opt/gtsofthub. Override por env se necessario.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
CONTAINER="${PG_CONTAINER:-ucm-postgres}"
DB="${PG_DB:-ucm}"

mkdir -p "${BACKUP_DIR}"

# Pre-flight: o container do banco esta rodando? Falha ALTO em vez de gerar
# um gzip vazio que se passaria por backup.
if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "[$(date -Is)] ERRO: container '${CONTAINER}' nao esta rodando — abortando (nenhum backup gerado)." >&2
  exit 1
fi

ts="$(date +%Y%m%d-%H%M%S)"
final="${BACKUP_DIR}/ucm-${ts}.sql.gz"
tmp="${final}.tmp"

echo "[$(date -Is)] Gerando backup: ${final}"

# Dump para .tmp; so vira o arquivo final se completar com sucesso E passar na
# validacao (integridade gzip + tamanho minimo plausivel). Assim um dump
# abortado nunca se disfarca de backup valido.
if docker exec -i "${CONTAINER}" pg_dump -U postgres -d "${DB}" | gzip > "${tmp}"; then
  if gzip -t "${tmp}" && [ "$(stat -c%s "${tmp}")" -gt 1024 ]; then
    mv "${tmp}" "${final}"
    echo "[$(date -Is)] OK: ${final} ($(stat -c%s "${final}") bytes)"
  else
    rm -f "${tmp}"
    echo "[$(date -Is)] ERRO: dump invalido (corrompido ou minusculo) — descartado." >&2
    exit 1
  fi
else
  rm -f "${tmp}"
  echo "[$(date -Is)] ERRO: pg_dump falhou — nenhum backup gerado." >&2
  exit 1
fi

echo "[$(date -Is)] Rotacionando (>${KEEP_DAYS} dias)..."
find "${BACKUP_DIR}" -type f -name "ucm-*.sql.gz" -mtime "+${KEEP_DAYS}" -delete || true

echo "[$(date -Is)] Concluido."
