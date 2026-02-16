> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# âœ… Checklist de Setup - O Que Precisa Fazer

> **Status:** Arquivos `.env` jÃ¡ criados automaticamente! âœ…

---

## âœ… JÃ FEITO AUTOMATICAMENTE:

- âœ… Arquivo `backend/.env` criado
- âœ… Arquivo `frontend/ENV_SETUP.md` criado

---

## âš ï¸ VOCÃŠ PRECISA FAZER MANUALMENTE:

### 1. Instalar Node.js 20+ (Se nÃ£o tiver)

**Verificar se tem:**
```bash
node --version
```

**Se nÃ£o tiver Node.js:**

1. **Download:** https://nodejs.org/ (baixar versÃ£o LTS)
2. **Instalar** o instalador (Next, Next, Install)
3. **Reiniciar** o terminal/PowerShell
4. **Verificar:**
   ```bash
   node --version
   npm --version
   ```

**Tempo:** ~5 minutos

---

### 2. Instalar Docker Desktop (Se nÃ£o tiver)

**Verificar se tem:**
```bash
docker --version
```

**Se nÃ£o tiver Docker:**

1. **Download:** https://www.docker.com/products/docker-desktop/
2. **Instalar** Docker Desktop
3. **Reiniciar** o PC
4. **Abrir** Docker Desktop e aguardar iniciar (Ã­cone na bandeja)
5. **Verificar:**
   ```bash
   docker --version
   docker-compose --version
   ```

**Tempo:** ~10 minutos (incluindo download)

---

### 3. Iniciar Docker (PostgreSQL + Redis)

**ApÃ³s Docker instalado:**

```bash
# Ir para pasta do projeto
cd unified-commerce-platform

# Iniciar PostgreSQL e Redis
docker-compose up -d postgres redis

# Verificar se estÃ£o rodando
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

### 5. Instalar DependÃªncias do Backend

```bash
cd backend
npm install
```

**Tempo:** ~2-5 minutos (primeira vez)

---

### 6. Instalar DependÃªncias do Frontend

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

## ðŸ“‹ RESUMO DO QUE FAZER:

1. âœ… **Arquivos .env** - JÃ CRIADOS
2. âš ï¸ **Instalar Node.js** (se nÃ£o tiver) - 5 min
3. âš ï¸ **Instalar Docker Desktop** (se nÃ£o tiver) - 10 min
4. âš ï¸ **Iniciar Docker** - 2 min
5. âš ï¸ **Executar Migration** - 1 min
6. âš ï¸ **npm install** (backend) - 3 min
7. âš ï¸ **npm install** (frontend) - 3 min
8. âš ï¸ **Testar** - 2 min

**Total:** ~25-30 minutos (se nÃ£o tiver nada instalado)

---

## ðŸš€ Depois de Concluir:

Me avise quando terminar e eu:
1. âœ… Validarei que tudo estÃ¡ funcionando
2. âœ… Testarei as transaÃ§Ãµes ACID
3. âœ… Prepararei dados reais (produtos da mÃ£e)
4. âœ… ComeÃ§aremos a FASE 1 (PDV perfeito)

---

## ðŸ’¡ Dicas:

- **Se Node.js jÃ¡ estiver instalado:** Pule passo 1
- **Se Docker jÃ¡ estiver instalado:** Pule passo 2
- **Se der erro:** Consulte `SETUP-INICIAL.md` para troubleshooting

---

**Ãšltima atualizaÃ§Ã£o:** Janeiro 2025  
**Status:** Arquivos de configuraÃ§Ã£o criados âœ… | Aguardando instalaÃ§Ã£o de prÃ©-requisitos


