# Como Rodar Testes — Backend

> **Importante:** Testes de integração precisam do PostgreSQL e Redis rodando.

---

## 🚀 Pré-requisitos

### 1. Iniciar Containers Docker

**Antes de rodar os testes, você DEVE iniciar os containers:**

```powershell
# Na raiz do projeto
docker-compose -f config/docker-compose.yml up -d postgres redis
```

**Verificar se estão rodando:**
```powershell
docker ps
# Deve mostrar: ucm-postgres e ucm-redis
```

---

## 🧪 Tipos de Testes

### 1. Testes Unitários (Não precisam de banco)

```powershell
cd backend
npm run test:unit
```

**O que testa:**
- Lógica de serviços isolada
- Validações
- Transformações de dados

**Tempo:** ~5-10 segundos

---

### 2. Testes de Integração (Precisam de banco)

```powershell
# 1. Garantir que containers estão rodando
docker-compose -f ../config/docker-compose.yml up -d postgres redis

# 2. Aguardar 5 segundos para serviços iniciarem
Start-Sleep -Seconds 5

# 3. Rodar testes
cd backend
npm run test:integration
```

**O que testa:**
- Conexão com banco de dados
- Health checks
- Endpoints da API
- Integração entre módulos

**Tempo:** ~30-60 segundos

---

### 3. Todos os Testes

```powershell
cd backend
npm test
```

**O que testa:**
- Unitários + Integração

**Tempo:** ~1-2 minutos

---

## ⚠️ Problemas Comuns

### Erro: `ECONNREFUSED 127.0.0.1:5432`

**Causa:** PostgreSQL não está rodando.

**Solução:**
```powershell
# Iniciar containers
docker-compose -f config/docker-compose.yml up -d postgres redis

# Verificar
docker ps | Select-String "postgres|redis"
```

---

### Erro: `Maximum call stack size exceeded`

**Causa:** Dependência circular no NestJS ou problema de configuração.

**Solução:**
1. Verificar se há dependências circulares nos módulos
2. Limpar cache do Jest:
   ```powershell
   Remove-Item -Recurse -Force backend/node_modules/.cache -ErrorAction SilentlyContinue
   npm run test:integration
   ```

---

### Testes Pulando (Skipped)

**Causa:** App não inicializou (banco não conectou).

**Solução:**
- Verificar se containers estão rodando
- Verificar variáveis de ambiente (`.env` no backend)
- Aguardar mais tempo antes de rodar testes

---

## 📋 Checklist Antes de Rodar Testes

- [ ] Docker Desktop está rodando
- [ ] Containers `ucm-postgres` e `ucm-redis` estão ativos
- [ ] Arquivo `.env` existe no `backend/`
- [ ] Variáveis `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` estão configuradas

---

## 🔧 Configuração de Ambiente para Testes

O arquivo `backend/src/test/jest.env.ts` define variáveis padrão para testes:

```typescript
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = '...'; // Padrão para testes
process.env.ENCRYPTION_KEY = '...'; // Padrão para testes
```

**Variáveis de banco:** Devem vir do `.env` ou do `docker-compose.yml`.

---

## 📚 Documentação Relacionada

- **Setup completo:** `docs/07-setup/COMO-INICIAR-AMBIENTE.md`
- **Scripts de teste:** `scripts/test/`

---

**Última atualização:** 09/01/2026
