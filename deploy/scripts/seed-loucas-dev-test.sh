#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"
CATALOG_FILE="${ROOT_DIR}/scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo .env nao encontrado: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$CATALOG_FILE" ]]; then
  echo "Catalogo nao encontrado: $CATALOG_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if docker network inspect ucmtest_ucm-test-net >/dev/null 2>&1; then
  docker run --rm \
    --network ucmtest_ucm-test-net \
    --env-file "$ENV_FILE" \
    -v "${ROOT_DIR}:/workspace" \
    -w /workspace/backend \
    node:20-alpine \
    sh -lc "npm run seed:catalog -- --input /workspace/scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json --whatsapp-instance ${EVOLUTION_INSTANCE:-loucas-teste}"
  exit 0
fi

cd "${ROOT_DIR}/backend"
npm run seed:catalog -- --input "$CATALOG_FILE" --whatsapp-instance "${EVOLUTION_INSTANCE:-loucas-teste}"
