#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# deploy.sh - atualiza o UCM/GTSoftHub a partir do GitHub e valida.
#
# Uso (no servidor):
#   ssh ubuntu@gtsofthub.com.br 'bash /opt/gtsofthub/deploy/scripts/deploy.sh'
#
# Fluxo: git pull --ff-only -> build (com build-args do .env, ex.
# NEXT_PUBLIC_TENANT_ID) -> up -d -> health-check (o script FALHA se o
# health != 200 apos ~2min).
#
# NAO roda migrations: o schema so muda via migration:run explicito (receita
# em docs/superpowers/handoffs/2026-07-01-faxina-followups.md). deploy.sh e
# so para atualizacoes de codigo.
# ============================================================================

REPO="/opt/gtsofthub"
DEPLOY_DIR="${REPO}/deploy"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT="deploy"
HEALTH_URL="https://gtsofthub.com.br/api/v1/health"

log() { echo "==> $*"; }
require() { command -v "$1" >/dev/null 2>&1 || { echo "ERRO: comando '$1' nao encontrado" >&2; exit 1; }; }

require git; require docker; require curl
[ -d "${REPO}/.git" ] || { echo "ERRO: repo git nao encontrado em ${REPO}" >&2; exit 1; }
[ -f "${ENV_FILE}" ]   || { echo "ERRO: .env nao encontrado em ${ENV_FILE}" >&2; exit 1; }

log "1/4 Atualizando codigo (git pull --ff-only)"
git -C "${REPO}" pull --ff-only

cd "${DEPLOY_DIR}"

log "2/4 Build (--env-file, com build-args)"
docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build

log "3/4 Subindo containers (up -d)"
docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

log "4/4 Health-check (${HEALTH_URL})"
for i in $(seq 1 24); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${HEALTH_URL}" || true)"
  if [ "${code}" = "200" ]; then
    log "OK: health 200. Deploy concluido com sucesso."
    exit 0
  fi
  echo "   health=${code} (tentativa ${i}/24)..."
  sleep 5
done

echo "ERRO: health != 200 apos ~2min. Deploy FALHOU." >&2
exit 1
