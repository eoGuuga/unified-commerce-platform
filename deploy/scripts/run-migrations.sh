#!/usr/bin/env bash
set -euo pipefail

# Aplica migrations SQL no Postgres (dentro do container)
# Uso: bash deploy/scripts/run-migrations.sh

MIG_DIR="./scripts/migrations"

for f in \
  "001-initial-schema.sql" \
  "002-security-and-performance.sql" \
  "003-whatsapp-conversations.sql" \
  "004-audit-log-metadata.sql" \
  "005-audit-action-enum-values.sql" \
  "006-idempotency.sql" \
  "007-add-coupon-code-to-pedidos.sql" \
  "008-usuarios-email-unique-por-tenant.sql" \
  "009-rls-force-and-extra-policies.sql" \
  "010-idempotency-unique-tenant-operation.sql"
do
  path="${MIG_DIR}/${f}"
  if [[ -f "${path}" ]]; then
    echo "Aplicando ${f}..."
    docker exec -i ucm-postgres psql -v ON_ERROR_STOP=1 -U postgres -d ucm < "${path}"
  fi
done

echo "OK: migrations aplicadas."

