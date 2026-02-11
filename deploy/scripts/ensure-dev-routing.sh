#!/usr/bin/env bash
set -euo pipefail

# Garante que o nginx de producao consegue resolver o stack dev/test.
# Uso: bash deploy/scripts/ensure-dev-routing.sh

NGINX_CONTAINER="ucm-nginx"
TEST_NET="$(docker network ls --filter name=ucmtest_ --format '{{.Name}}' | head -n 1)"

if ! docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
  echo "Aviso: container ${NGINX_CONTAINER} nao encontrado."
  exit 0
fi

if [[ -z "$TEST_NET" ]]; then
  echo "Aviso: rede do stack dev/test nao encontrada."
  exit 0
fi

if ! docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' \
  "$NGINX_CONTAINER" | grep -qx "$TEST_NET"; then
  docker network connect "$TEST_NET" "$NGINX_CONTAINER"
  echo "Conectado ${NGINX_CONTAINER} na rede ${TEST_NET}."
fi

if docker exec -i "$NGINX_CONTAINER" nginx -t >/dev/null 2>&1; then
  docker exec -i "$NGINX_CONTAINER" nginx -s reload
  echo "Nginx recarregado."
else
  echo "Erro: nginx -t falhou no ${NGINX_CONTAINER}." >&2
  exit 1
fi
