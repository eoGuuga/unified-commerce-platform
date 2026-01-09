# Setup Ambiente de Desenvolvimento no Servidor — Comandos Diretos

> **Para executar diretamente no servidor via SSH**

---

## 🚀 Comandos para Copiar/Colar no Servidor

### 1. Criar docker-compose.dev.yml

```bash
cd /opt/ucm
cat > deploy/docker-compose.dev.yml <<'EOF'
version: '3.8'

services:
  postgres-dev:
    image: postgres:15-alpine
    container_name: ucm-postgres-dev
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ucm_dev
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ../scripts/migrations:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ucm_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - ucm-dev-net

  redis-dev:
    image: redis:7-alpine
    container_name: ucm-redis-dev
    restart: unless-stopped
    ports:
      - "127.0.0.1:6380:6379"
    volumes:
      - redis_dev_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - ucm-dev-net

volumes:
  postgres_dev_data:
    driver: local
  redis_dev_data:
    driver: local

networks:
  ucm-dev-net:
    driver: bridge
EOF
```

---

### 2. Iniciar Containers

```bash
cd /opt/ucm
docker compose -f deploy/docker-compose.dev.yml up -d
```

---

### 3. Aguardar e Verificar

```bash
sleep 10
docker ps | grep -E "postgres-dev|redis-dev"
```

---

### 4. Aplicar Migrations

```bash
cd /opt/ucm
for migration in scripts/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Aplicando: $(basename "$migration")"
    docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -v ON_ERROR_STOP=1 < "$migration" || echo "⚠️  Aviso: Migration pode ter falhado (pode ser normal se já foi aplicada)"
  fi
done
```

---

### 5. Criar Usuário do App (não-superuser)

```bash
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
```

---

### 6. Verificar se Está Funcionando

```bash
# Testar PostgreSQL
docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -c "SELECT 1;"

# Testar Redis
docker exec -i ucm-redis-dev redis-cli ping
```

---

## ✅ Pronto!

Agora você tem:
- ✅ PostgreSQL rodando na porta 5433 (banco: `ucm_dev`)
- ✅ Redis rodando na porta 6380
- ✅ Migrations aplicadas
- ✅ Usuário `ucm_app` criado

---

## 🔌 Conectar do Seu PC (Windows)

**1. Criar SSH Tunnel (deixar rodando):**

```powershell
ssh -L 5433:localhost:5433 -L 6380:localhost:6380 ubuntu@gtsofthub.com.br -N
```

**2. Configurar .env no backend:**

```powershell
cd backend
# Criar .env com:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ucm_dev
# REDIS_URL=redis://localhost:6380
```

---

**Última atualização:** 09/01/2026
