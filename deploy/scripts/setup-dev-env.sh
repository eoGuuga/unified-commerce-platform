#!/usr/bin/env bash
# Setup do ambiente de desenvolvimento no VPS
# Uso: bash deploy/scripts/setup-dev-env.sh

set -euo pipefail

cd "$(dirname "$0")/../.."

echo "=== Setup Ambiente de Desenvolvimento no VPS ==="

# 1. Iniciar containers de desenvolvimento
echo "[1/4] Iniciando containers de desenvolvimento..."
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. Aguardar serviços ficarem prontos
echo "[2/4] Aguardando serviços ficarem prontos..."
sleep 10

# 3. Verificar se estão rodando
echo "[3/4] Verificando containers..."
if ! docker ps | grep -q "ucm-postgres-dev"; then
  echo "❌ Erro: ucm-postgres-dev não está rodando"
  exit 1
fi

if ! docker ps | grep -q "ucm-redis-dev"; then
  echo "❌ Erro: ucm-redis-dev não está rodando"
  exit 1
fi

echo "✅ Containers rodando:"
docker ps | grep -E "ucm-postgres-dev|ucm-redis-dev"

# 4. Aplicar migrations
echo "[4/4] Aplicando migrations no banco de desenvolvimento..."
for migration in scripts/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "  Aplicando: $(basename "$migration")"
    docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -v ON_ERROR_STOP=1 < "$migration" || {
      echo "⚠️  Aviso: Migration $(basename "$migration") pode ter falhado (pode ser normal se já foi aplicada)"
    }
  fi
done

# 5. Criar usuário do app (não-superuser) para RLS
echo "[5/5] Criando usuário do app (não-superuser)..."
docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ucm_app') THEN
    CREATE ROLE ucm_app LOGIN PASSWORD 'ucm_app_dev_password';
    GRANT CONNECT ON DATABASE ucm_dev TO ucm_app;
    GRANT USAGE ON SCHEMA public TO ucm_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ucm_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ucm_app;
  END IF;
END $$;
SQL

echo ""
echo "=== ✅ Setup Concluído ==="
echo ""
echo "Containers de desenvolvimento rodando:"
echo "  - PostgreSQL: localhost:5433 (banco: ucm_dev)"
echo "  - Redis: localhost:6380"
echo ""
echo "Para conectar do seu PC (Windows):"
echo "  1. SSH Tunnel: ssh -L 5433:localhost:5433 -L 6380:localhost:6380 ubuntu@gtsofthub.com.br -N"
echo "  2. No seu .env local:"
echo "     DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ucm_dev"
echo "     REDIS_URL=redis://localhost:6380"
echo ""
echo "Para rodar testes no servidor:"
echo "  cd /opt/ucm/backend"
echo "  npm run test:integration"
echo ""
