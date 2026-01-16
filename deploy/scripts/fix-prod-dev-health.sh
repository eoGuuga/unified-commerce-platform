#!/usr/bin/env bash
set -euo pipefail

# Fix health for prod + dev using existing .env files (no secrets in script).
# Usage: sudo -i; /opt/ucm/deploy/scripts/fix-prod-dev-health.sh
# Optional: RESET_REDIS=1 to reset Redis volumes (cache only).

RESET_REDIS="${RESET_REDIS:-0}"

prod_dir="/opt/ucm/deploy"
dev_dir="/opt/ucm-test-repo/deploy"
prod_url="https://gtsofthub.com.br/api/v1/health"
dev_url="https://dev.gtsofthub.com.br/api/v1/health"

require_file() {
  if [ ! -f "$1" ]; then
    echo "Missing file: $1" >&2
    exit 1
  fi
}

is_http_ok() {
  local url="$1"
  local code
  code="$(curl -k -sS -o /dev/null -w "%{http_code}" "$url" || true)"
  [ "$code" = "200" ]
}

update_env_urls() {
  local env_file="$1"
  # shellcheck disable=SC1090
  set -a; source "$env_file"; set +a

  if [ -n "${DB_APP_USER:-}" ] && [ -n "${DB_APP_PASSWORD:-}" ]; then
    sed -i '/^DATABASE_URL=/d' "$env_file"
    echo "DATABASE_URL=postgresql://${DB_APP_USER}:${DB_APP_PASSWORD}@postgres:5432/ucm" >> "$env_file"
  elif [ -n "${POSTGRES_PASSWORD:-}" ]; then
    sed -i '/^DATABASE_URL=/d' "$env_file"
    echo "DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/ucm" >> "$env_file"
  fi

  if [ -n "${REDIS_PASSWORD:-}" ]; then
    if grep -q '^REDIS_URL=' "$env_file"; then
      sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379|" "$env_file"
    else
      echo "REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379" >> "$env_file"
    fi
  fi
}

reset_redis_if_requested() {
  local container_name="$1"
  if [ "$RESET_REDIS" != "1" ]; then
    return 0
  fi

  local vol
  vol=$(docker inspect "$container_name" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  if [ -n "$vol" ]; then
    docker volume rm "$vol" >/dev/null 2>&1 || true
  fi
}

echo "==> PROD"
require_file "$prod_dir/.env"
require_file "$prod_dir/docker-compose.prod.yml"
update_env_urls "$prod_dir/.env"
reset_redis_if_requested "ucm-redis"
REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' "$prod_dir/.env" | cut -d= -f2)"
if [ -n "$REDIS_PASSWORD" ]; then
  REDIS_PASSWORD="$REDIS_PASSWORD" docker compose --env-file "$prod_dir/.env" -f "$prod_dir/docker-compose.prod.yml" up -d redis
fi
docker compose --env-file "$prod_dir/.env" -f "$prod_dir/docker-compose.prod.yml" up -d postgres
if is_http_ok "$prod_url"; then
  echo "Prod health OK. Skipping backend restart."
else
  docker compose --env-file "$prod_dir/.env" -f "$prod_dir/docker-compose.prod.yml" up -d --no-deps --force-recreate backend
fi

echo "==> DEV"
require_file "$dev_dir/.env"
require_file "$dev_dir/docker-compose.test.yml"
update_env_urls "$dev_dir/.env"
reset_redis_if_requested "ucm-redis-test"
REDIS_PASSWORD="$(grep '^REDIS_PASSWORD=' "$dev_dir/.env" | cut -d= -f2)"
if [ -n "$REDIS_PASSWORD" ]; then
  REDIS_PASSWORD="$REDIS_PASSWORD" docker compose --env-file "$dev_dir/.env" -f "$dev_dir/docker-compose.test.yml" --project-name ucmtest up -d redis
fi
docker compose --env-file "$dev_dir/.env" -f "$dev_dir/docker-compose.test.yml" --project-name ucmtest up -d postgres
if is_http_ok "$dev_url"; then
  echo "Dev health OK. Skipping backend restart."
else
  docker compose --env-file "$dev_dir/.env" -f "$dev_dir/docker-compose.test.yml" --project-name ucmtest up -d --no-deps --force-recreate backend
fi

echo "==> HEALTH"
curl -k -s https://gtsofthub.com.br/api/v1/health || true
echo
curl -k -s https://dev.gtsofthub.com.br/api/v1/health || true
echo
