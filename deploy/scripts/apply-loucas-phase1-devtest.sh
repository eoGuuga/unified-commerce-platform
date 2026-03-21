#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

echo "==> Aplicando catalogo da Loucas Por Brigadeiro"
bash "${ROOT_DIR}/deploy/scripts/seed-loucas-dev-test.sh"

echo "==> Recriando backend de dev/teste para ler configuracao nova"
cd "$ROOT_DIR"
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.test.yml --project-name ucmtest up -d --build backend

echo "==> Health check"
curl -fsS "${FRONTEND_URL%/}/api/v1/health" >/dev/null
echo "Fase 1 da Loucas aplicada em dev/teste."
