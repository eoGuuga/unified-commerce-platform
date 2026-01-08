# 🎯 Primeiros Passos - Guia Prático

> **Objetivo:** Validar que tudo está funcionando antes de começar a desenvolver.

---

## ✅ Checklist Inicial (30 minutos)

### 1. Verificar Pré-requisitos

```bash
# Node.js (precisa 20+)
node --version
# Esperado: v20.x.x ou superior

# npm
npm --version
# Esperado: 9.x.x ou superior

# Docker (para PostgreSQL e Redis)
docker --version
# Esperado: Docker version 24.x.x ou superior

# Docker Compose
docker-compose --version
# Esperado: Docker Compose version 2.x.x ou superior
```

**Se algum não estiver instalado:**
- Node.js: https://nodejs.org/ (LTS)
- Docker Desktop: https://www.docker.com/products/docker-desktop/

---

### 2. Configurar Docker (PostgreSQL + Redis)

```bash
# Ir para o diretório do projeto
cd unified-commerce-platform

# Iniciar apenas PostgreSQL e Redis
docker-compose up -d postgres redis

# Verificar se estão rodando
docker ps
# Deve mostrar: ucm-postgres e ucm-redis
```

**Se der erro:**
- Verificar se Docker Desktop está rodando
- Verificar se as portas 5432 (PostgreSQL) e 6379 (Redis) estão livres

**Verificar logs:**
```bash
docker-compose logs postgres
docker-compose logs redis
```

---

### 3. Configurar Backend (.env)

**Criar arquivo `backend/.env`:**

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
JWT_SECRET=seu-jwt-secret-super-seguro-min-32-chars-para-desenvolvimento
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=seu-refresh-secret-super-seguro-min-32-chars
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

### 4. Instalar Dependências do Backend

```bash
cd backend
npm install
```

**Se der erro:**
- Verificar se Node.js está instalado corretamente
- Tentar: `npm cache clean --force` e `npm install` novamente

---

### 5. Executar Migration Inicial (Banco de Dados)

```bash
# Ainda na pasta backend
# Executar migration SQL
docker exec -i ucm-postgres psql -U postgres -d ucm < ../scripts/migrations/001-initial-schema.sql
```

**Verificar se funcionou:**
```bash
# Conectar ao banco e verificar tabelas
docker exec -it ucm-postgres psql -U postgres -d ucm
# Dentro do psql:
\dt
# Deve listar todas as tabelas (usuarios, produtos, pedidos, etc.)
\q
```

---

### 6. Testar Backend

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
- Verificar se Docker está rodando
- Verificar se DATABASE_URL no .env está correto
- Verificar logs do backend

---

### 7. Configurar Frontend (.env.local)

**Criar arquivo `frontend/.env.local`:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

### 8. Instalar Dependências do Frontend

```bash
cd ../frontend
npm install
```

---

### 9. Testar Frontend

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
- [ ] Backend `.env` configurado
- [ ] Dependências do backend instaladas
- [ ] Migration executada com sucesso
- [ ] Backend rodando (http://localhost:3001)
- [ ] Frontend `.env.local` configurado
- [ ] Dependências do frontend instaladas
- [ ] Frontend rodando (http://localhost:3000)

**Se todos os itens estão ✅, você está pronto para começar a desenvolver!**

---

## 🚀 Próximo Passo: FASE 1 - Fundamentos

Agora que tudo está funcionando, podemos começar a **FASE 1: Fundamentos**.

**O que vamos fazer:**
1. Criar migrations avançadas (UsageLog, Idempotency, Webhooks, Conversations)
2. Implementar serviços core (IdempotencyService, EncryptionService, UsageLogService)
3. Integrar Mock Providers
4. Adaptar OpenAI Service para Ollama

**Guia completo:** [`PLANO_COMPLETO_PARTE_1.md`](./PLANO_COMPLETO_PARTE_1.md)

---

## 🐛 Troubleshooting

### Problema: Docker não inicia

**Solução:**
```bash
# Verificar se Docker Desktop está rodando
# Verificar se portas estão livres
netstat -ano | findstr :5432  # Windows
lsof -i :5432                 # Linux/Mac
```

### Problema: Backend não conecta ao banco

**Solução:**
```bash
# Verificar DATABASE_URL no .env
# Deve ser: postgresql://postgres:postgres@localhost:5432/ucm

# Testar conexão manual
docker exec -it ucm-postgres psql -U postgres -d ucm
```

### Problema: Migration falha

**Solução:**
```bash
# Verificar se banco existe
docker exec -it ucm-postgres psql -U postgres -c "\l"

# Criar banco se não existir
docker exec -it ucm-postgres psql -U postgres -c "CREATE DATABASE ucm;"
```

### Problema: Frontend não conecta ao backend

**Solução:**
```bash
# Verificar NEXT_PUBLIC_API_URL no .env.local
# Deve ser: http://localhost:3001/api/v1

# Verificar se backend está rodando
curl http://localhost:3001/api/v1/health
```

---

## 💡 Dicas

1. **Mantenha Docker rodando** enquanto desenvolve
2. **Use dois terminais**: um para backend, outro para frontend
3. **Commits frequentes**: faça commits pequenos e descritivos
4. **Teste constantemente**: teste cada feature após implementar
5. **Consulte documentação**: sempre que tiver dúvidas

---

**Última atualização:** Janeiro 2025  
**Status:** ✅ Guia Prático de Validação Completo
