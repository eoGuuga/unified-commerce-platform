# Ambiente de Desenvolvimento no VPS — 24/7

> **Objetivo:** Ter PostgreSQL e Redis rodando 24/7 no servidor para desenvolvimento e testes.  
> **Vantagem:** Ambiente sempre disponível, não precisa do Docker Desktop local.

---

## 🎯 Estratégia

**Duas opções de containers no VPS:**

1. **Produção** (`docker-compose.prod.yml`) - `ucm-postgres`, `ucm-redis`, `ucm-backend`, `ucm-frontend`, `ucm-nginx`
2. **Desenvolvimento** (`docker-compose.dev.yml`) - Apenas `ucm-postgres-dev`, `ucm-redis-dev` (portas diferentes)

**Por quê separar?**
- Produção não pode parar
- Desenvolvimento pode ser reiniciado/testado sem afetar produção
- Portas diferentes evitam conflitos

---

## 🚀 Setup Inicial (Uma vez)

### 1. Fazer Upload do docker-compose.dev.yml para o Servidor

**O arquivo já existe no repositório:** `deploy/docker-compose.dev.yml`

**Se ainda não estiver no servidor, faça upload:**
```powershell
# No seu PC (Windows)
scp deploy\docker-compose.dev.yml ubuntu@gtsofthub.com.br:/opt/ucm/deploy/
```

---

### 2. Setup Automatizado (Recomendado)

**No servidor (SSH):**
```bash
cd /opt/ucm
chmod +x deploy/scripts/setup-dev-env.sh
bash deploy/scripts/setup-dev-env.sh
```

**O que o script faz:**
- ✅ Inicia containers de desenvolvimento
- ✅ Aguarda serviços ficarem prontos
- ✅ Aplica todas as migrations
- ✅ Cria usuário `ucm_app` (não-superuser) para RLS

---

### 3. Setup Manual (Alternativa)

**Se preferir fazer manualmente:**

```bash
# 1. Iniciar containers
cd /opt/ucm
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. Aguardar serviços
sleep 10

# 3. Aplicar migrations
for migration in scripts/migrations/*.sql; do
  docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -v ON_ERROR_STOP=1 < "$migration"
done
```

---

### 4. Verificar se Está Funcionando

```bash
# Ver containers
docker ps | grep -E "postgres-dev|redis-dev"

# Testar conexão PostgreSQL
docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -c "SELECT 1;"

# Testar conexão Redis
docker exec -i ucm-redis-dev redis-cli ping
```

---

## 🧪 Rodar Testes no Servidor

### Via SSH

```bash
# 1. Conectar no servidor
ssh ubuntu@gtsofthub.com.br

# 2. Ir para o projeto
cd /opt/ucm/backend

# 3. Verificar se containers estão rodando
docker ps | grep -E "postgres-dev|redis-dev"

# 4. Rodar testes
npm run test:integration
```

---

### Via VS Code Remote (Recomendado)

**1. Instalar extensão "Remote - SSH" no VS Code**

**2. Conectar no servidor:**
- `Ctrl+Shift+P` → "Remote-SSH: Connect to Host"
- Digite: `ubuntu@gtsofthub.com.br`

**3. Abrir pasta do projeto:**
- `/opt/ucm`

**4. Rodar testes diretamente no VS Code:**
- Terminal integrado: `cd backend && npm run test:integration`

---

## 🔧 Configuração do Backend para Desenvolvimento

### Opção 1: Rodar Backend Localmente (conecta no VPS)

**No seu PC (Windows):**

```powershell
# 1. Criar .env no backend apontando para o servidor
cd backend
# .env
DATABASE_URL=postgresql://postgres:postgres@gtsofthub.com.br:5433/ucm_dev
REDIS_URL=redis://gtsofthub.com.br:6380
```

**⚠️ Problema:** Portas 5433 e 6380 não estão abertas no firewall (só 22/80/443).

**Solução:** Usar SSH Tunnel.

---

### Opção 2: SSH Tunnel (Recomendado) ⭐

**No seu PC (Windows - PowerShell):**

```powershell
# Criar túnel SSH para PostgreSQL E Redis (um comando só)
ssh -L 5433:localhost:5433 -L 6380:localhost:6380 ubuntu@gtsofthub.com.br -N
```

**Deixar rodando em um terminal separado** (não fechar).

**Agora no seu PC:**
```powershell
# Copiar arquivo de exemplo
cd backend
copy .env.dev.vps.example .env

# OU criar manualmente com:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ucm_dev
# REDIS_URL=redis://localhost:6380
```

**Vantagem:** Backend roda localmente, mas usa banco do servidor (24/7 disponível).

---

### Opção 3: Rodar Backend Direto no Servidor (Mais Simples)

**No servidor (SSH):**

```bash
cd /opt/ucm/backend

# Instalar dependências (se necessário)
npm install

# Rodar em modo desenvolvimento
npm run start:dev
```

**Acessar:**
- Backend: `http://gtsofthub.com.br:3001/api/v1` (se porta 3001 estiver aberta)
- OU via SSH tunnel: `ssh -L 3001:localhost:3001 ubuntu@gtsofthub.com.br -N`

---

## 📋 Checklist de Setup

### No Servidor (VPS)
- [ ] Fazer upload de `deploy/docker-compose.dev.yml` (se ainda não estiver)
- [ ] Rodar script de setup: `bash deploy/scripts/setup-dev-env.sh`
- [ ] Verificar containers: `docker ps | grep -E "postgres-dev|redis-dev"`
- [ ] Testar conexão: `docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -c "SELECT 1;"`

### No Seu PC (Windows)
- [ ] Criar SSH Tunnel: `ssh -L 5433:localhost:5433 -L 6380:localhost:6380 ubuntu@gtsofthub.com.br -N`
- [ ] Copiar `.env.dev.vps.example` para `backend/.env`
- [ ] Rodar testes: `cd backend && npm run test:integration`

---

## 🔒 Segurança

**Portas de desenvolvimento (5433, 6380) estão bindadas apenas em `127.0.0.1` (localhost).**

**Isso significa:**
- ✅ Apenas processos no próprio servidor podem acessar
- ✅ Não estão expostas externamente
- ✅ Seguro para desenvolvimento

**Para acessar do seu PC:** Use SSH Tunnel (Opção 2 acima).

---

## 🎯 Fluxo de Trabalho Recomendado

### Desenvolvimento Local + Banco no Servidor

1. **SSH Tunnel ativo** (portas 5433 e 6380)
2. **Backend rodando localmente** (Windows)
3. **Banco de dados no servidor** (VPS)
4. **Testes rodam localmente** mas usam banco do servidor

**Vantagens:**
- ✅ Ambiente sempre disponível (24/7)
- ✅ Não precisa do Docker Desktop
- ✅ Desenvolvimento rápido (hot reload local)
- ✅ Dados persistentes no servidor

---

## 📚 Comandos Úteis

### Verificar Containers

```bash
docker ps | grep -E "postgres|redis"
docker logs ucm-postgres-dev
docker logs ucm-redis-dev
```

### Reiniciar Containers

```bash
docker compose -f deploy/docker-compose.dev.yml restart
```

### Parar Containers

```bash
docker compose -f deploy/docker-compose.dev.yml down
```

### Ver Logs

```bash
docker compose -f deploy/docker-compose.dev.yml logs -f
```

---

## ⚠️ Importante

**Nunca misture produção com desenvolvimento:**
- ✅ Produção usa `docker-compose.prod.yml` (portas 5432, 6379)
- ✅ Desenvolvimento usa `docker-compose.dev.yml` (portas 5433, 6380)
- ✅ Bancos separados: `ucm` (prod) vs `ucm_dev` (dev)

---

**Última atualização:** 09/01/2026
