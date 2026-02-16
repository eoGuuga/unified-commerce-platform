> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# ðŸš€ COMO INICIAR O AMBIENTE

> **Guia passo a passo para iniciar o ambiente de desenvolvimento**

---

## âš ï¸ PRÃ‰-REQUISITO: Docker Desktop

**Docker Desktop precisa estar RODANDO!**

### 1. Verificar se Docker Desktop estÃ¡ instalado:
```powershell
docker --version
```

### 2. Se nÃ£o estiver instalado:
- **Download:** https://www.docker.com/products/docker-desktop
- Instale e reinicie o computador

### 3. Iniciar Docker Desktop:
- Procure "Docker Desktop" no menu Iniciar do Windows
- Clique para iniciar
- Aguarde o Ã­cone do Docker aparecer na bandeja do sistema (canto inferior direito)
- Aguarde atÃ© o status ficar "Docker Desktop is running"

---

## ðŸš€ OPÃ‡ÃƒO 1: Script AutomÃ¡tico (RECOMENDADO)

Uma vez que Docker Desktop estÃ¡ rodando:

```powershell
# Na raiz do projeto
.\scripts\DEV-RODAR-TUDO.ps1
# OU usar wrapper na raiz (compatibilidade): .\DEV-RODAR-TUDO.ps1
```

Este script faz tudo automaticamente:
- âœ… Verifica Docker
- âœ… Inicia containers (PostgreSQL + Redis)
- âœ… Aguarda serviÃ§os ficarem prontos
- âœ… Verifica dependÃªncias
- âœ… Aplica migrations
- âœ… Cria usuÃ¡rio do banco para o app (sem superuser) para RLS ser efetivo

---

## ðŸ”§ OPÃ‡ÃƒO 2: Manual (Passo a Passo)

### Passo 1: Iniciar Containers

```powershell
# Na raiz do projeto
docker-compose -f config/docker-compose.yml up -d postgres redis
```

**Aguarde 10-15 segundos** para os containers iniciarem.

### Passo 2: Verificar se containers estÃ£o rodando

```powershell
docker ps
```

VocÃª deve ver:
```
ucm-postgres    ...    Up ... seconds
ucm-redis       ...    Up ... seconds
```

### Passo 3: Iniciar Backend

```powershell
cd backend
npm run start:dev
```

**Aguarde atÃ© ver:**
```
[Nest] INFO [NestApplication] Nest application successfully started
```

### Passo 4: Verificar se backend estÃ¡ rodando

Em outro terminal ou navegador:
```powershell
curl http://localhost:3001/api/v1/whatsapp/health
```

Deve retornar:
```json
{"status":"ok","timestamp":"...","service":"UCM Backend"}
```

---

## âœ… VERIFICAÃ‡ÃƒO FINAL

### Containers Docker:
```powershell
docker ps --filter "name=ucm-"
```

### Backend:
- Health check: http://localhost:3001/api/v1/whatsapp/health
- Swagger: http://localhost:3001/api/docs

### URLs DisponÃ­veis:
- **Backend API:** http://localhost:3001/api/v1
- **Swagger Docs:** http://localhost:3001/api/docs
- **Adminer (DB):** http://localhost:8080
- **Redis UI:** http://localhost:8081

---

## ðŸ› PROBLEMAS COMUNS

### Erro: "Docker daemon is not running"
**SoluÃ§Ã£o:** Inicie Docker Desktop manualmente

### Erro: "port is already allocated"
**SoluÃ§Ã£o:** Pare containers antigos:
```powershell
docker-compose -f config/docker-compose.yml down
```

### Erro: "connection refused" no backend
**SoluÃ§Ã£o:** 
1. Verifique se containers estÃ£o rodando: `docker ps`
2. Verifique logs: `docker logs ucm-postgres`
3. Aguarde mais alguns segundos

---

## ðŸ“ PRÃ“XIMOS PASSOS

ApÃ³s ambiente iniciado:

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

**Ãšltima atualizaÃ§Ã£o:** 08/01/2025

### Nota importante (multi-tenant / autenticacao)
- Em dev/test, o login aceita `x-tenant-id`.
- Em producao, o tenant vem somente do JWT.
- Em producao, nao use usuario superuser no Postgres (superuser pode bypassar RLS). O setup cria `ucm_app` no Docker para simular o cenario real.

---

## Nota (auth/tenant e CSRF)

- Em dev/test, o login aceita `x-tenant-id` no header.
- Em producao, o tenant vem somente do JWT e o header e ignorado.
- Para habilitar CSRF com cookies, defina `CSRF_ENABLED=true` e envie `x-csrf-token`.
- Para permitir header em dev/test, use `ALLOW_TENANT_FROM_REQUEST=true`.

