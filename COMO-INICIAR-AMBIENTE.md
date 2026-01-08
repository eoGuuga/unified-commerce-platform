# 🚀 COMO INICIAR O AMBIENTE

> **Guia passo a passo para iniciar o ambiente de desenvolvimento**

---

## ⚠️ PRÉ-REQUISITO: Docker Desktop

**Docker Desktop precisa estar RODANDO!**

### 1. Verificar se Docker Desktop está instalado:
```powershell
docker --version
```

### 2. Se não estiver instalado:
- **Download:** https://www.docker.com/products/docker-desktop
- Instale e reinicie o computador

### 3. Iniciar Docker Desktop:
- Procure "Docker Desktop" no menu Iniciar do Windows
- Clique para iniciar
- Aguarde o ícone do Docker aparecer na bandeja do sistema (canto inferior direito)
- Aguarde até o status ficar "Docker Desktop is running"

---

## 🚀 OPÇÃO 1: Script Automático (RECOMENDADO)

Uma vez que Docker Desktop está rodando:

```powershell
# Na raiz do projeto
.\INICIAR-AMBIENTE.ps1
```

Este script faz tudo automaticamente:
- ✅ Verifica Docker
- ✅ Inicia containers (PostgreSQL + Redis)
- ✅ Aguarda serviços ficarem prontos
- ✅ Verifica dependências

---

## 🔧 OPÇÃO 2: Manual (Passo a Passo)

### Passo 1: Iniciar Containers

```powershell
# Na raiz do projeto
docker-compose -f config/docker-compose.yml up -d postgres redis
```

**Aguarde 10-15 segundos** para os containers iniciarem.

### Passo 2: Verificar se containers estão rodando

```powershell
docker ps
```

Você deve ver:
```
ucm-postgres    ...    Up ... seconds
ucm-redis       ...    Up ... seconds
```

### Passo 3: Iniciar Backend

```powershell
cd backend
npm run start:dev
```

**Aguarde até ver:**
```
[Nest] INFO [NestApplication] Nest application successfully started
```

### Passo 4: Verificar se backend está rodando

Em outro terminal ou navegador:
```powershell
curl http://localhost:3001/api/v1/health
```

Deve retornar:
```json
{"status":"ok","timestamp":"...","service":"UCM Backend"}
```

---

## ✅ VERIFICAÇÃO FINAL

### Containers Docker:
```powershell
docker ps --filter "name=ucm-"
```

### Backend:
- Health check: http://localhost:3001/api/v1/health
- Swagger: http://localhost:3001/api/docs

### URLs Disponíveis:
- **Backend API:** http://localhost:3001/api/v1
- **Swagger Docs:** http://localhost:3001/api/docs
- **Adminer (DB):** http://localhost:8080
- **Redis UI:** http://localhost:8081

---

## 🐛 PROBLEMAS COMUNS

### Erro: "Docker daemon is not running"
**Solução:** Inicie Docker Desktop manualmente

### Erro: "port is already allocated"
**Solução:** Pare containers antigos:
```powershell
docker-compose -f config/docker-compose.yml down
```

### Erro: "connection refused" no backend
**Solução:** 
1. Verifique se containers estão rodando: `docker ps`
2. Verifique logs: `docker logs ucm-postgres`
3. Aguarde mais alguns segundos

---

## 📝 PRÓXIMOS PASSOS

Após ambiente iniciado:

1. **Testar backend:**
   ```powershell
   .\scripts\test\test-backend.ps1
   ```

2. **Iniciar frontend (opcional):**
   ```powershell
   cd frontend
   npm run dev
   ```

3. **Acessar Swagger:**
   - Abra: http://localhost:3001/api/docs

---

**Última atualização:** 08/01/2025
