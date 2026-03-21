#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/evolution.test.env"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.evolution.test.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo nao encontrado: $ENV_FILE" >&2
  echo "Copie deploy/evolution.test.env.example para deploy/evolution.test.env e ajuste a chave." >&2
  exit 1
fi

docker network inspect ucmtest_ucm-test-net >/dev/null 2>&1 || {
  echo "Rede ucmtest_ucm-test-net nao encontrada. Suba primeiro o stack de dev/teste." >&2
  exit 1
}

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

echo "Evolution API de dev/teste iniciado."
echo "Container: ucm-evolution-test"
echo "URL interna esperada para o backend: http://evolution-api:8080"
echo "URL local do VPS para administracao: http://127.0.0.1:8081"
echo "Manager local do VPS: http://127.0.0.1:8081/manager"
