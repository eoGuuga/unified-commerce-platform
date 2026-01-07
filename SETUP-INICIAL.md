# 🚀 Setup Inicial - Passo a Passo

> **Objetivo:** Validar que tudo está funcionando antes de começar a desenvolver.

---

## ✅ Checklist de Pré-requisitos

### 1. Node.js 20+ ✅

**Verificar:**
```bash
node --version
# Esperado: v20.x.x ou superior

npm --version
# Esperado: 9.x.x ou superior
```

**Se não tiver:**
- Download: https://nodejs.org/ (LTS)
- Instalar e reiniciar terminal

---

### 2. Docker Desktop ✅

**Verificar:**
```bash
docker --version
# Esperado: Docker version 24.x.x ou superior

docker-compose --version
# Esperado: Docker Compose version 2.x.x ou superior
```

**Se não tiver:**
- Download: https://www.docker.com/products/docker-desktop/
- Instalar e reiniciar PC
- Abrir Docker Desktop e aguardar iniciar

---

## 📋 Passo 1: Configurar Docker

### 1.1 Iniciar PostgreSQL e Redis

```bash
# Ir para pasta do projeto
cd unified-commerce-platform

# Iniciar apenas PostgreSQL e Redis
docker-compose up -d postgres redis

# Verificar se estão rodando
docker ps
# Deve mostrar: ucm-postgres e ucm-redis
```

**Se der erro:**
- Verificar se Docker Desktop está rodando
- Verificar se portas 5432 (PostgreSQL) e 6379 (Redis) estão livres
- Tentar: `docker-compose down` e depois `docker-compose up -d postgres redis`

---

### 1.2 Executar Migration Inicial

```bash
# Executar migration SQL
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql
```

**Verificar se funcionou:**
```bash
# Conectar ao banco e verificar tabelas
docker exec -it ucm-postgres psql -U postgres -d ucm

# Dentro do psql:
\dt
# Deve listar todas as tabelas (usuarios, produtos, pedidos, etc)

\q
# Sair do psql
```

---

## 📋 Passo 2: Configurar Backend

### 2.1 Criar arquivo `.env`

**Criar arquivo:** `backend/.env`

```env
# APPLICATION
NODE_ENV=development
PORT=3001
API_VERSION=v1

# DATABASE (Docker Local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm

# REDIS (Docker Local)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=seu-jwt-secret-super-seguro-min-32-chars-para-desenvolvimento-local
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=seu-refresh-secret-super-seguro-min-32-chars-local
JWT_REFRESH_EXPIRATION=7d

# IA (Ollama - quando instalar)
USE_OLLAMA=false
OLLAMA_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2:3b

# WhatsApp (Mock para desenvolvimento)
WHATSAPP_PROVIDER=mock

# Pagamentos (Mock para desenvolvimento)
PAYMENT_PROVIDER=mock

# Email (Resend Free - quando precisar)
RESEND_API_KEY=
EMAIL_FROM=noreply@exemplo.com
```

---

### 2.2 Instalar Dependências

```bash
cd backend
npm install
```

**Se der erro:**
- Verificar se Node.js está instalado: `node --version`
- Tentar: `npm cache clean --force` e `npm install` novamente

---

### 2.3 Testar Backend

```bash
# Ainda na pasta backend
npm run start:dev
```

**Esperado:**
```
[Nest] 12345  - 01/01/2025, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/01/2025, 10:00:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345  - 01/01/2025, 10:00:00 AM     LOG [NestApplication] Nest application successfully started
```

**Testar endpoint:**
```bash
# Em outro terminal
curl http://localhost:3001/api/v1/health
# Esperado: {"status":"ok"}
```

**Se der erro:**
- Verificar se Docker está rodando: `docker ps`
- Verificar se DATABASE_URL no .env está correto
- Verificar logs do backend

---

## 📋 Passo 3: Configurar Frontend

### 3.1 Criar arquivo `.env.local`

**Criar arquivo:** `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

### 3.2 Instalar Dependências

```bash
cd frontend
npm install
```

**Se der erro:**
- Verificar se Node.js está instalado
- Tentar: `npm cache clean --force` e `npm install` novamente

---

### 3.3 Testar Frontend

```bash
# Ainda na pasta frontend
npm run dev
```

**Esperado:**
```
- ready started server on 0.0.0.0:3000
- Local: http://localhost:3000
```

**Abrir no navegador:**
- http://localhost:3000
- Deve mostrar a página inicial

---

## ✅ Validação Completa

### Checklist Final:

- [ ] Docker está rodando (PostgreSQL + Redis)
- [ ] Migration executada com sucesso
- [ ] Backend `.env` configurado
- [ ] Dependências do backend instaladas
- [ ] Backend rodando (http://localhost:3001)
- [ ] Frontend `.env.local` configurado
- [ ] Dependências do frontend instaladas
- [ ] Frontend rodando (http://localhost:3000)

**Se todos os itens estão ✅, você está pronto para começar a desenvolver!**

---

## 🐛 Troubleshooting

### Problema: Docker não inicia

**Solução:**
- Verificar se Docker Desktop está rodando
- Verificar se portas estão livres:
  ```bash
  netstat -ano | findstr :5432  # Windows
  ```

---

### Problema: Backend não conecta ao banco

**Solução:**
- Verificar DATABASE_URL no `.env`
- Deve ser: `postgresql://postgres:postgres@localhost:5432/ucm`
- Testar conexão manual:
  ```bash
  docker exec -it ucm-postgres psql -U postgres -d ucm
  ```

---

### Problema: Migration falha

**Solução:**
- Verificar se banco existe:
  ```bash
  docker exec -it ucm-postgres psql -U postgres -c "\l"
  ```
- Criar banco se não existir:
  ```bash
  docker exec -it ucm-postgres psql -U postgres -c "CREATE DATABASE ucm;"
  ```

---

### Problema: Frontend não conecta ao backend

**Solução:**
- Verificar NEXT_PUBLIC_API_URL no `.env.local`
- Deve ser: `http://localhost:3001/api/v1`
- Verificar se backend está rodando:
  ```bash
  curl http://localhost:3001/api/v1/health
  ```

---

## 🚀 Próximo Passo

Após validar tudo está funcionando:

1. **Garantir ACID Perfeito** (testar transações)
2. **Preparar Dados Reais** (cadastrar produtos da mãe)
3. **Começar FASE 1** (validações de estoque no PDV)

---

**Última atualização:** Janeiro 2025  
**Status:** ✅ Guia de Setup Completo
