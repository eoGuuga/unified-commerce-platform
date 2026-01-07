# ✅ Checklist de Setup - O Que Precisa Fazer

> **Status:** Arquivos `.env` já criados automaticamente! ✅

---

## ✅ JÁ FEITO AUTOMATICAMENTE:

- ✅ Arquivo `backend/.env` criado
- ✅ Arquivo `frontend/.env.local` criado

---

## ⚠️ VOCÊ PRECISA FAZER MANUALMENTE:

### 1. Instalar Node.js 20+ (Se não tiver)

**Verificar se tem:**
```bash
node --version
```

**Se não tiver Node.js:**

1. **Download:** https://nodejs.org/ (baixar versão LTS)
2. **Instalar** o instalador (Next, Next, Install)
3. **Reiniciar** o terminal/PowerShell
4. **Verificar:**
   ```bash
   node --version
   npm --version
   ```

**Tempo:** ~5 minutos

---

### 2. Instalar Docker Desktop (Se não tiver)

**Verificar se tem:**
```bash
docker --version
```

**Se não tiver Docker:**

1. **Download:** https://www.docker.com/products/docker-desktop/
2. **Instalar** Docker Desktop
3. **Reiniciar** o PC
4. **Abrir** Docker Desktop e aguardar iniciar (ícone na bandeja)
5. **Verificar:**
   ```bash
   docker --version
   docker-compose --version
   ```

**Tempo:** ~10 minutos (incluindo download)

---

### 3. Iniciar Docker (PostgreSQL + Redis)

**Após Docker instalado:**

```bash
# Ir para pasta do projeto
cd unified-commerce-platform

# Iniciar PostgreSQL e Redis
docker-compose up -d postgres redis

# Verificar se estão rodando
docker ps
```

**Esperado:** Ver `ucm-postgres` e `ucm-redis` rodando

**Tempo:** ~2 minutos

---

### 4. Executar Migration

```bash
# Executar migration SQL
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql
```

**Tempo:** ~1 minuto

---

### 5. Instalar Dependências do Backend

```bash
cd backend
npm install
```

**Tempo:** ~2-5 minutos (primeira vez)

---

### 6. Instalar Dependências do Frontend

```bash
cd frontend
npm install
```

**Tempo:** ~2-5 minutos (primeira vez)

---

### 7. Testar Tudo

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Abrir no navegador:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001/api/v1/health

---

## 📋 RESUMO DO QUE FAZER:

1. ✅ **Arquivos .env** - JÁ CRIADOS
2. ⚠️ **Instalar Node.js** (se não tiver) - 5 min
3. ⚠️ **Instalar Docker Desktop** (se não tiver) - 10 min
4. ⚠️ **Iniciar Docker** - 2 min
5. ⚠️ **Executar Migration** - 1 min
6. ⚠️ **npm install** (backend) - 3 min
7. ⚠️ **npm install** (frontend) - 3 min
8. ⚠️ **Testar** - 2 min

**Total:** ~25-30 minutos (se não tiver nada instalado)

---

## 🚀 Depois de Concluir:

Me avise quando terminar e eu:
1. ✅ Validarei que tudo está funcionando
2. ✅ Testarei as transações ACID
3. ✅ Prepararei dados reais (produtos da mãe)
4. ✅ Começaremos a FASE 1 (PDV perfeito)

---

## 💡 Dicas:

- **Se Node.js já estiver instalado:** Pule passo 1
- **Se Docker já estiver instalado:** Pule passo 2
- **Se der erro:** Consulte `SETUP-INICIAL.md` para troubleshooting

---

**Última atualização:** Janeiro 2025  
**Status:** Arquivos de configuração criados ✅ | Aguardando instalação de pré-requisitos
