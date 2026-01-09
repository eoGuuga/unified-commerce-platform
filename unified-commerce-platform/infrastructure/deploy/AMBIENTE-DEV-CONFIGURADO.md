# ✅ Ambiente de Desenvolvimento Configurado — 24/7

> **Status:** ✅ **CONFIGURADO E FUNCIONANDO**  
> **Data:** 09/01/2026

---

## ✅ O Que Foi Configurado

- ✅ **PostgreSQL de desenvolvimento** rodando na porta **5433** (banco: `ucm_dev`)
- ✅ **Redis de desenvolvimento** rodando na porta **6380**
- ✅ **Migrations aplicadas** (alguns erros são normais se já existiam)
- ✅ **Usuário `ucm_app` criado** (não-superuser para RLS)
- ✅ **Containers com restart automático** (`unless-stopped`)

---

## 🔌 Conectar do Seu PC (Windows)

### 1. Criar SSH Tunnel (deixar rodando)

**Abra um terminal PowerShell e execute:**

```powershell
ssh -L 5433:localhost:5433 -L 6380:localhost:6380 ubuntu@gtsofthub.com.br -N
```

**⚠️ IMPORTANTE:** Deixe esse terminal aberto! Ele cria o "túnel" entre seu PC e o servidor.

---

### 2. Configurar .env no Backend (Local)

**No seu PC, no diretório `backend/`:**

```powershell
cd backend

# Criar .env
@"
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ucm_dev
REDIS_URL=redis://localhost:6380
JWT_SECRET=dev-jwt-secret-change-in-production-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ENCRYPTION_KEY=dev-encryption-key-change-in-production-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
FRONTEND_URL=http://localhost:3000
ENABLE_SWAGGER=true
WHATSAPP_DEFAULT_SHIPPING_AMOUNT=10
"@ | Out-File -FilePath .env -Encoding utf8
```

---

### 3. Testar Conexão

```powershell
# Rodar backend
cd backend
npm run start:dev

# Em outro terminal, rodar testes
npm run test:integration
```

---

## 🎯 Comandos Úteis no Servidor

### Ver Status dos Containers

```bash
docker ps | grep -E "postgres-dev|redis-dev"
```

### Ver Logs

```bash
docker compose -f deploy/docker-compose.dev.yml logs -f
```

### Reiniciar Containers

```bash
cd /opt/ucm
docker compose -f deploy/docker-compose.dev.yml restart
```

### Parar Containers

```bash
cd /opt/ucm
docker compose -f deploy/docker-compose.dev.yml down
```

### Iniciar Novamente

```bash
cd /opt/ucm
docker compose -f deploy/docker-compose.dev.yml up -d
```

---

## 📋 Verificação Rápida

**No servidor:**
```bash
# Testar PostgreSQL
docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -c "SELECT COUNT(*) FROM tenants;"

# Testar Redis
docker exec -i ucm-redis-dev redis-cli ping
```

**Deve retornar:**
- PostgreSQL: número de tenants (ou 0 se vazio)
- Redis: `PONG`

---

## ✅ Pronto!

Agora você tem:
- ✅ Ambiente 24/7 disponível no servidor
- ✅ Não precisa do Docker Desktop local
- ✅ Dados persistentes no servidor
- ✅ Produção e desenvolvimento separados (sem conflitos)

**Próximo passo:** Criar SSH Tunnel e configurar `.env` no seu PC.

---

**Última atualização:** 09/01/2026
