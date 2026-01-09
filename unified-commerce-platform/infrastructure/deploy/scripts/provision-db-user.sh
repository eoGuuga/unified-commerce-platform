#!/usr/bin/env bash
set -euo pipefail

# Garante usuario do app sem superuser + grants minimos
# Requer: docker compose up do postgres
#
# Uso:
#   docker exec -i ucm-postgres psql -U postgres -d ucm < /dev/stdin

DB_APP_USER="${DB_APP_USER:-ucm_app}"
DB_APP_PASSWORD="${DB_APP_PASSWORD:-}"

if [[ -z "${DB_APP_PASSWORD}" ]]; then
  echo "ERRO: DB_APP_PASSWORD vazio (defina no env file)."
  exit 1
fi

docker exec -i ucm-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ucm <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_APP_USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${DB_APP_USER}', '${DB_APP_PASSWORD}');
  END IF;
END
\$\$;

ALTER ROLE ${DB_APP_USER} NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE ucm TO ${DB_APP_USER};
GRANT USAGE ON SCHEMA public TO ${DB_APP_USER};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${DB_APP_USER};
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${DB_APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${DB_APP_USER};
SQL

echo "OK: usuario do app pronto: ${DB_APP_USER}"

