# Como Usar Banco do Servidor (24/7) — Guia Rápido

> **Objetivo:** Usar PostgreSQL e Redis do servidor para desenvolvimento/testes, sem precisar do Docker Desktop local.

---

## 🚀 Setup Rápido (5 minutos)

### 1. No Servidor (SSH)

```bash
# Conectar no servidor
ssh ubuntu@gtsofthub.com.br

# Ir para o projeto
cd /opt/ucm

# Rodar script de setup (faz tudo automaticamente)
chmod +x deploy/scripts/setup-dev-env.sh
bash deploy/scripts/setup-dev-env.sh
```

**O que o script faz:**
- ✅ Cria containers `ucm-postgres-dev` e `ucm-redis-dev`
- ✅ Aplica todas as migrations
- ✅ Cria usuário do app (não-superuser)
- ✅ Tudo pronto para usar!

---

### 2. No Seu PC (Windows)

**A) Criar SSH Tunnel (deixar rodando):**

```powershell
# Abrir um terminal PowerShell e deixar rodando
ssh -L 5433:localhost:5433 -L 6380:localhost:6380 ubuntu@gtsofthub.com.br -N
```

**⚠️ IMPORTANTE:** Deixe esse terminal aberto! Ele cria o "túnel" entre seu PC e o servidor.

---

**B) Configurar .env no Backend:**

```powershell
# No backend/
cd backend

# Criar .env com conexão para o servidor
@"
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ucm_dev
REDIS_URL=redis://localhost:6380
JWT_SECRET=dev-jwt-secret-change-in-production-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ENCRYPTION_KEY=dev-encryption-key-change-in-production-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
FRONTEND_URL=http://localhost:3000
ENABLE_SWAGGER=true
"@ | Out-File -FilePath .env -Encoding utf8
```

---

**C) Testar Conexão:**

```powershell
# Rodar backend
cd backend
npm run start:dev

# Em outro terminal, rodar testes
npm run test:integration
```

---

## ✅ Pronto!

**Status:** ✅ **AMBIENTE CONFIGURADO E FUNCIONANDO**

Agora você tem:
- ✅ PostgreSQL rodando 24/7 no servidor (porta 5433, banco: `ucm_dev`)
- ✅ Redis rodando 24/7 no servidor (porta 6380)
- ✅ Migrations aplicadas
- ✅ Usuário `ucm_app` criado
- ✅ Containers com restart automático

**Próximo passo:** Criar SSH Tunnel e configurar `.env` no seu PC (veja abaixo).

---

## 📋 Comandos Úteis

### Verificar Containers no Servidor

```bash
# Via SSH
ssh ubuntu@gtsofthub.com.br
docker ps | grep -E "postgres-dev|redis-dev"
```

### Reiniciar Containers

```bash
# No servidor
cd /opt/ucm
docker compose -f deploy/docker-compose.dev.yml restart
```

### Ver Logs

```bash
# No servidor
docker compose -f deploy/docker-compose.dev.yml logs -f
```

---

## 🔒 Segurança

**Portas 5433 e 6380 estão bindadas apenas em `127.0.0.1` (localhost do servidor).**

**Isso significa:**
- ✅ Não estão expostas externamente
- ✅ Apenas processos no servidor podem acessar
- ✅ Para acessar do seu PC, precisa do SSH Tunnel

---

## 📚 Documentação Completa

- **Guia detalhado:** `deploy/AMBIENTE-DEVELOPMENT-VPS.md`
- **Como rodar testes:** `backend/COMO-RODAR-TESTES.md`

---

**Última atualização:** 09/01/2026
