> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# RelatÃ³rio completo (Projeto + OperaÃ§Ã£o) â€” UCM / Unified Commerce Platform
> **Objetivo:** documentar, em um Ãºnico lugar, **tudo o que existe no projeto** (o que jÃ¡ estava pronto antes), **tudo o que foi melhorado/automatizado** durante a fase de â€œperfeiÃ§Ã£oâ€ (seguranÃ§a, multi-tenant/RLS, deploy e hardening), **o estado atual**, e **o que falta fazer** (com ordem recomendada).
>
> **Este documento Ã© propositalmente â€œend-to-endâ€**: produto â†’ arquitetura â†’ banco â†’ seguranÃ§a â†’ deploy â†’ operaÃ§Ã£o â†’ testes â†’ backlog.
>
> **Base de verdade adicional:** este repositÃ³rio jÃ¡ possui uma documentaÃ§Ã£o extensa. Este relatÃ³rio **consolida** e aponta para os documentos originais quando o detalhamento jÃ¡ existe.

---

## Ambiente e identificadores (sem segredos)
> **Importante:** este bloco **nÃ£o** deve conter senhas/keys. Ã‰ apenas referÃªncia operacional.

### ProduÃ§Ã£o (VPS)
- **Servidor/VPS**: OVHcloud (Ubuntu)
- **IP pÃºblico (VPS)**: `37.59.118.210` *(atual no momento desta fase)*
- **Hostname (VPS)**: `vps-0e3446f6.vps.ovh.net` *(referÃªncia operacional)*
- **Path do projeto no servidor**: `/opt/ucm`
- **ServiÃ§os (Docker)**:
  - `ucm-nginx` (publica 80/443)
  - `ucm-frontend` (interno 3000)
  - `ucm-backend` (interno 3001)
  - `ucm-postgres` (interno 5432)
  - `ucm-redis` (interno 6379)
- **UFW (produÃ§Ã£o)**: liberado 22/80/443.

### Dev/Teste (VPS)
- **DomÃ­nio dev**: `https://dev.gtsofthub.com.br`
- **Path do projeto (teste)**: `/opt/ucm-test-repo`
- **Compose**: `deploy/docker-compose.test.yml` (project `ucmtest`)
- **Containers**: `ucm-frontend-test`, `ucm-backend-test`, `ucm-postgres-test`, `ucm-redis-test`
- **Rede**: `ucm-nginx` conectado em `ucm-test-net` para rotear o dev.

### DomÃ­nio
- **DomÃ­nio escolhido**: `gtsofthub.com.br`
- **Status DNS**: ativo (propagado).

---

## SumÃ¡rio
- [1) Contexto e visÃ£o do produto](#1-contexto-e-visÃ£o-do-produto)
- [2) O que jÃ¡ existia no projeto (antes desta fase)](#2-o-que-jÃ¡-existia-no-projeto-antes-desta-fase)
- [3) O que foi feito nesta fase (perfeiÃ§Ã£o: produÃ§Ã£o + seguranÃ§a + robustez)](#3-o-que-foi-feito-nesta-fase-perfeiÃ§Ã£o-produÃ§Ã£o--seguranÃ§a--robustez)
- [4) Arquitetura atual (monorepo + serviÃ§os + rede)](#4-arquitetura-atual-monorepo--serviÃ§os--rede)
- [5) Multi-tenancy e isolamento por RLS (PostgreSQL)](#5-multi-tenancy-e-isolamento-por-rls-postgresql)
- [6) SeguranÃ§a: aplicaÃ§Ã£o, proxy e servidor](#6-seguranÃ§a-aplicaÃ§Ã£o-proxy-e-servidor)
- [7) Deploy e operaÃ§Ã£o (produÃ§Ã£o VPS)](#7-deploy-e-operaÃ§Ã£o-produÃ§Ã£o-vps)
- [8) Backups e restore (runbook)](#8-backups-e-restore-runbook)
- [9) Testes e â€œgatesâ€ de qualidade](#9-testes-e-gates-de-qualidade)
- [10) DomÃ­nio e HTTPS (gtsofthub.com.br)](#10-domÃ­nio-e-https-gtsofthubcombr)
- [11) O que falta fazer (backlog priorizado)](#11-o-que-falta-fazer-backlog-priorizado)
- [12) Onboarding para novo dev (checklist rÃ¡pido)](#12-onboarding-para-novo-dev-checklist-rÃ¡pido)

---

## Linha do tempo (resumo factual)
> Um â€œmapaâ€ do que aconteceu na prÃ¡tica, em ordem aproximada.

### Base do projeto (antes desta fase)
- Estrutura monorepo + docs extensas jÃ¡ presentes.
- Fases do produto descritas e com partes jÃ¡ implementadas (PDV, mÃ³dulos do backend, Bot WhatsApp 3.1/3.2 etc.).

### Fase â€œperfeiÃ§Ã£oâ€ (produÃ§Ã£o + hardening + RLS efetivo)
- Compra/configuraÃ§Ã£o do VPS e deploy em `/opt/ucm`.
- CorreÃ§Ã£o de problemas de **CRLF â†’ LF** em scripts e `/opt/ucm/deploy/.env` (para permitir `bash`/`source` corretamente).
- Ajustes para build/deploy:
  - correÃ§Ã£o TypeScript em `DbContextService.getRepository<T extends ObjectLiteral>()`
  - correÃ§Ã£o de migration (Ã­ndice com `NOW()` â†’ removido do predicate)
  - correÃ§Ã£o do Dockerfile do frontend (remover `COPY /public` inexistente)
- Subida do compose de produÃ§Ã£o + migrations + criaÃ§Ã£o do user `ucm_app` (sem superuser).
- ImplementaÃ§Ã£o/ativaÃ§Ã£o do RLS por request com `TenantDbContextInterceptor` e `AsyncLocalStorage`.
- Hardening do servidor:
  - UFW restritivo (22/80/443)
  - unattended-upgrades
  - fail2ban (sshd)
  - rotinas de backup + logs
- Observabilidade/auto-recuperaÃ§Ã£o (no VPS):
  - Netdata bound em localhost + SSH tunnel
  - watchdog (systemd timer) + logrotate
- DomÃ­nio definido (`gtsofthub.com.br`) com DNS/HTTPS concluÃ­dos (443 ativo).

---

## 1) Contexto e visÃ£o do produto
**Nome do produto:** Unified Commerce Platform (UCM)  
**Tipo:** SaaS multi-tenant (mÃºltiplas lojas/negÃ³cios)  
**Problema central:** *overselling* ao vender em mÃºltiplos canais sem sincronizaÃ§Ã£o.  
**SoluÃ§Ã£o:** backend centralizado com transaÃ§Ãµes ACID, reserva de estoque e automaÃ§Ã£o (WhatsApp Bot).

**TrÃªs faces do produto**
- **PDV Web** (tablet/loja fÃ­sica)
- **E-commerce** (storefront)
- **WhatsApp Bot** (atendimento + pedidos + automaÃ§Ãµes)

**Documentos-base (produto)**
- `docs/LEGADO/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
- `docs/INDICE-DOCUMENTACAO.md`

---

## 2) O que jÃ¡ existia no projeto (antes desta fase)
O repositÃ³rio jÃ¡ vinha com uma base bem completa (produto + cÃ³digo + docs).

### 2.1 Estrutura e stack
- **Monorepo**
  - `backend/`: NestJS + TypeScript + TypeORM
  - `frontend/`: Next.js (App Router) + React + Tailwind
  - `scripts/`: migrations SQL e automaÃ§Ãµes
  - `docs/`: documentaÃ§Ã£o extensa e organizada
- **Infra local (dev):** Docker (Postgres + Redis) + scripts em PowerShell

### 2.2 Funcionalidades jÃ¡ descritas/implementadas
(conforme README e Documento Mestre)
- **Backend**: Auth (JWT), Products, Orders, WhatsApp, Health, Tenants; rate limiting; audit log; idempotÃªncia; cache.
- **Frontend**: PDV funcional; Admin/Dashboard; base de e-commerce.
- **WhatsApp Bot**: FASE 3.1 e 3.2 concluÃ­das (respostas + pedidos simples), com NLP pt-BR.
- **Banco**: schema completo; migrations; Ã­ndices; RLS â€œhabilitadoâ€ (complementado e tornado **efetivo** nesta fase).

**ReferÃªncias**
- `README.md`
- `docs/LEGADO/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
- `COMO-INICIAR-AMBIENTE.md`

---

## 3) O que foi feito nesta fase (perfeiÃ§Ã£o: produÃ§Ã£o + seguranÃ§a + robustez)
Esta fase focou em **tornar o sistema vendÃ¡vel/operÃ¡vel** com um padrÃ£o de produÃ§Ã£o: isolamento multi-tenant real, deploy em VPS, hardening do servidor, observabilidade e rotinas operacionais.

### 3.1 ProduÃ§Ã£o em 1 VPS (Docker Compose + Nginx)
- **Alvo:** 1 VPS Ubuntu rodando `nginx`, `frontend`, `backend`, `postgres`, `redis` via `deploy/docker-compose.prod.yml`.
- **Proxy reverso:** Nginx na frente (porta 80), roteando:
  - `/` â†’ `frontend`
  - `/api/*` â†’ `backend`

Arquivos principais:
- `deploy/docker-compose.prod.yml`
- `deploy/nginx/ucm.conf`
- `deploy/env.prod.example` (modelo)
- `deploy/README-PRODUCAO.md`

### 3.2 Multi-tenant â€œde verdadeâ€ (RLS realmente aplicado)
Foram implementados mecanismos para garantir que **todas as queries do app** executem com o `tenant_id` correto, e que o Postgres aplique o isolamento por RLS sem â€œbypassâ€.

**Pilares**
- **UsuÃ¡rio do app sem superuser** (em produÃ§Ã£o): evita bypass de RLS.
  - Script: `deploy/scripts/provision-db-user.sh`
- **Tenant context por request**: abre transaÃ§Ã£o e executa `SET LOCAL app.current_tenant_id = <tenant>`
  - Interceptor: `backend/src/common/interceptors/tenant-db-context.interceptor.ts`
- **EntityManager request-scoped** com `AsyncLocalStorage`: garante que os repositÃ³rios usem o manager transacional correto
  - `backend/src/modules/common/services/db-context.service.ts`

### 3.3 CorreÃ§Ãµes de build e robustez de deploy
- **Migrations fail-fast**: `psql -v ON_ERROR_STOP=1` no deploy (para falhar no primeiro erro).
  - `deploy/scripts/run-migrations.sh`
  - `deploy/scripts/provision-db-user.sh`
- **Migration 001 corrigida** para remover predicado com `NOW()` em Ã­ndice (Postgres exige IMMUTABLE em predicate de Ã­ndice parcial).
- **Frontend Dockerfile** ajustado para nÃ£o copiar `/public` inexistente.
  - `frontend/Dockerfile`

### 3.4 SeguranÃ§a em produÃ§Ã£o (aplicaÃ§Ã£o + Nginx)
- **Swagger em produÃ§Ã£o**: desativado por padrÃ£o via env e tambÃ©m protegido no Nginx.
  - `ENABLE_SWAGGER=false` no `/opt/ucm/deploy/.env`
  - Nginx bloqueia `/api/docs` e `/api/docs-json` externamente (sÃ³ local/Docker).
  - `backend/src/main.ts` (toggle via `ENABLE_SWAGGER`)
  - `deploy/nginx/ucm.conf` (restriÃ§Ã£o de acesso)

### 3.5 Hardening do servidor (VPS)
AutomatizaÃ§Ãµes e configuraÃ§Ã£o â€œmÃ­nimo seguroâ€:
- UFW liberando **22/80/443** (HTTPS ativo)
- `unattended-upgrades` habilitado
- `fail2ban` (jail sshd)
- permissÃµes de `/opt/ucm/deploy/.env` como root-only
- cron de backup diÃ¡rio com log

Script:
- `deploy/scripts/post-deploy-hardening.sh`

### 3.6 OperaÃ§Ã£o e observabilidade
Implantado no servidor (runbook, fora do repo):
- **Netdata** bound em `127.0.0.1` (acesso via SSH tunnel)
- **Watchdog** (`ucm-watchdog.sh` + systemd timer) para healthcheck e auto-recuperaÃ§Ã£o
- **logrotate** para logs do watchdog e backup
- **Log rotation** dos containers via `logging: json-file` no compose

### 3.7 InventÃ¡rio do que mudou nesta fase (arquivos)
> Lista objetiva para auditoria/revisÃ£o.

**Backend (NestJS)**
- `backend/src/common/interceptors/tenant-db-context.interceptor.ts` â€” contexto do tenant por request + transaÃ§Ã£o + `set_config('app.current_tenant_id', ...)`.
- `backend/src/modules/common/services/db-context.service.ts` â€” `AsyncLocalStorage` + `runWithManager()` + `getRepository<T extends ObjectLiteral>()`.
- `backend/src/main.ts` â€” Helmet/CORS mais restritivos; Swagger condicionado a `ENABLE_SWAGGER`.
- `backend/src/app.module.ts` â€” interceptor aplicado globalmente (`APP_INTERCEPTOR`) + throttler guard.

**Banco (migrations SQL)**
- `scripts/migrations/001-initial-schema.sql` â€” correÃ§Ã£o de Ã­ndice (predicate com `NOW()` removido).
- `scripts/migrations/008-usuarios-email-unique-por-tenant.sql` â€” unicidade de e-mail por tenant.
- `scripts/migrations/009-rls-force-and-extra-policies.sql` â€” reforÃ§o e polÃ­ticas extras de RLS.
- `scripts/migrations/010-idempotency-unique-tenant-operation.sql` â€” idempotÃªncia Ãºnica por tenant/operaÃ§Ã£o.

**ProduÃ§Ã£o / Deploy**
- `deploy/docker-compose.prod.yml` â€” logging com rotaÃ§Ã£o + `init: true` + `ENABLE_SWAGGER` por env.
- `deploy/nginx/ucm.conf` â€” proxy + headers + bloqueio externo do Swagger + timeouts.
- `deploy/env.prod.example` â€” inclui `ENABLE_SWAGGER=false`.
- `deploy/scripts/run-migrations.sh` â€” `psql` com `ON_ERROR_STOP=1`.
- `deploy/scripts/provision-db-user.sh` â€” `psql` com `ON_ERROR_STOP=1` + grants mÃ­nimos para `ucm_app`.
- `deploy/scripts/backup-postgres.sh` â€” backup diÃ¡rio + rotaÃ§Ã£o.
- `deploy/scripts/post-deploy-hardening.sh` â€” UFW/cron/unattended-upgrades/fail2ban/permissÃµes.

**Frontend**
- `frontend/Dockerfile` â€” ajuste para build de produÃ§Ã£o sem `public/` inexistente.

---

## 4) Arquitetura atual (monorepo + serviÃ§os + rede)
### 4.1 Componentes
- **Frontend:** Next.js (porta interna 3000)
- **Backend:** NestJS (porta interna 3001, prefixo `/api/v1`)
- **PostgreSQL:** 15 (porta interna 5432)
- **Redis:** 7 (porta interna 6379)
- **Nginx:** 80 pÃºblico â†’ proxy para frontend/backend

### 4.2 ConfiguraÃ§Ã£o de produÃ§Ã£o (Docker Compose)
- Arquivo: `deploy/docker-compose.prod.yml`
- VariÃ¡veis principais:
  - `FRONTEND_URL` (CORS e ambiente do frontend)
  - `JWT_SECRET`, `ENCRYPTION_KEY`
  - `POSTGRES_PASSWORD`, `DB_APP_USER`, `DB_APP_PASSWORD`
  - `REDIS_PASSWORD`
  - `ENABLE_SWAGGER` (default false)

---

## 5) Multi-tenancy e isolamento por RLS (PostgreSQL)
### 5.1 Como o isolamento funciona
1. Cada tabela â€œde negÃ³cioâ€ tem `tenant_id`.
2. O Postgres aplica **Row Level Security** com policies usando uma variÃ¡vel de sessÃ£o:
   - `app.current_tenant_id`
3. A cada request HTTP, quando o tenant estÃ¡ presente, o backend:
   - abre transaÃ§Ã£o
   - executa `SELECT set_config('app.current_tenant_id', $tenantId, true)` (SET LOCAL)
   - executa toda a request com o `EntityManager` daquela transaÃ§Ã£o (via `DbContextService`)

Arquivos-chave:
- `backend/src/common/interceptors/tenant-db-context.interceptor.ts`
- `backend/src/modules/common/services/db-context.service.ts`
- migrations em `scripts/migrations/009-rls-force-and-extra-policies.sql`

### 5.2 Fonte do tenantId
Ordem:
1. `req.user.tenant_id` (JWT jÃ¡ autenticado)
2. Header `x-tenant-id`
3. Body (`tenantId` / `tenant_id`)

### 5.3 Regras importantes (decisÃ£o operacional)
- **ProduÃ§Ã£o deve usar DB user do app sem superuser** (ex.: `ucm_app`).  
  Superuser pode bypassar RLS.
- **Login exige tenant** (header `x-tenant-id`) para evitar autenticar â€œfora de tenantâ€.

---

## 6) SeguranÃ§a: aplicaÃ§Ã£o, proxy e servidor
### 6.1 AplicaÃ§Ã£o (backend)
- **Helmet** com CSP/COEP mais restritos em produÃ§Ã£o quando Swagger estÃ¡ desligado.
- **CORS**: em produÃ§Ã£o exige `FRONTEND_URL` e bloqueia origens desconhecidas.
- **Rate limiting** global + â€œstrictâ€ para rotas sensÃ­veis.
  - `backend/src/app.module.ts` (Throttler)
- **Swagger**: somente se `ENABLE_SWAGGER=true` (e mesmo assim, Nginx bloqueia externo).
  - `backend/src/main.ts`

### 6.2 Proxy (Nginx)
- Headers bÃ¡sicos de seguranÃ§a.
- Timeouts de proxy (evita travas em upstream).
- Bloqueio externo de `/api/docs` e `/api/docs-json`.
  - `deploy/nginx/ucm.conf`

### 6.3 Servidor (VPS)
- UFW, unattended upgrades, fail2ban, SSH hardening (PermitRootLogin no, limites de tentativas/sessÃµes).
- Rotinas de backup e logs.

---

## 7) Deploy e operaÃ§Ã£o (produÃ§Ã£o VPS)
### 7.1 â€œFonte de verdadeâ€ do deploy
Leia e siga:
- `deploy/README-PRODUCAO.md`

### 7.2 Ordem recomendada (produÃ§Ã£o)
1. Preparar VPS (Docker + UFW): `deploy/scripts/prod-setup-ubuntu.sh`
2. Criar `/opt/ucm/deploy/.env` a partir do exemplo
3. Subir `postgres` + `redis`
4. Rodar migrations: `deploy/scripts/run-migrations.sh`
5. Criar usuÃ¡rio do app (RLS real): `deploy/scripts/provision-db-user.sh`
6. Subir tudo: `docker compose ... up -d --build`
7. Hardening: `deploy/scripts/post-deploy-hardening.sh`

### 7.3 Smoke checks
Exemplos:
- `GET /api/v1/health`
- `GET /api/v1/health/ready`
- `GET /` (frontend via nginx)

---

## 8) Backups e restore (runbook)
### 8.1 Backup
- Script: `deploy/scripts/backup-postgres.sh`
- Cron sugerido (03:00 diÃ¡rio) com log:

```bash
0 3 * * * cd /opt/ucm && bash deploy/scripts/backup-postgres.sh >> /opt/ucm/backups/backup.log 2>&1
```

### 8.2 Restore de teste (padrÃ£o recomendado)
ObservaÃ§Ã£o crÃ­tica: `pg_dump` **nÃ£o inclui roles**. Se o dump referencia `ucm_app`, o restore deve criar a role antes.

Checklist (conceitual):
- subir um postgres temporÃ¡rio
- criar role(s) referenciadas
- restaurar dump
- sanity-check de contagens (tenants/usuarios/produtos)

---

## 9) Testes e â€œgatesâ€ de qualidade
### 9.1 Ambiente dev (Windows)
Documento: `docs/LEGADO/07-setup/COMO-INICIAR-AMBIENTE.md`

Script â€œfaz-tudoâ€ (dev):
- `scripts/DEV-RODAR-TUDO.ps1` (inicia containers, aplica migrations, garante user do app sem superuser, etc.)

### 9.2 E2E (WhatsApp / FASE 3.3)
- Script: `scripts/test/test-fase-3-3-e2e.ps1`
- Ele jÃ¡ inclui retentativas para rate-limit (429) e tenta garantir migrations crÃ­ticas quando docker estÃ¡ disponÃ­vel.

### 9.3 Gates recomendados antes de â€œvenderâ€
- `npm run lint`
- `npm run build`
- `npm run test` (unit/integration)
- E2E (principalmente WhatsApp + Orders)
- Smoke tests em produÃ§Ã£o (health + login + 1 fluxo de pedido)

---

## 10) DomÃ­nio e HTTPS (gtsofthub.com.br)
### 10.1 SituaÃ§Ã£o atual (2026-01-14)
- DNS ativo (A `@` e A `www` apontando para `37.59.118.210`).
- HTTPS ativo (443 liberado no UFW + certificados Let's Encrypt).
- Nginx com redirect HTTP â†’ HTTPS e www â†’ sem www.
- `FRONTEND_URL` ajustado para `https://gtsofthub.com.br`.

### 10.2 VerificaÃ§Ã£o rÃ¡pida
- `nslookup gtsofthub.com.br`
- `nslookup www.gtsofthub.com.br`
- `curl -I https://gtsofthub.com.br/`
- `curl -I https://www.gtsofthub.com.br/` (301 para sem www)

---

## 11) O que falta fazer (backlog priorizado)
### 11.1 CrÃ­tico (para produÃ§Ã£o â€œcomercialâ€)
- **Onboarding de segundo dev** com acesso seguro ao VPS (ideal: chaves SSH; se insistir em senha, reforÃ§ar polÃ­ticas e 2FA onde possÃ­vel).
- **Runbook formal de incidentes** (SLA, checklist de quedas, rollback, restore).

### 11.2 Alto
- **CI/CD mÃ­nimo** (build + lint + tests + build docker em pipeline).
- **Alertas** (Netdata/health): avisar no WhatsApp/Email quando cair.
- **Rotina de update** (janela mensal, atualizaÃ§Ã£o docker images, revisÃ£o de logs).

### 11.3 MÃ©dio
- Evoluir e-commerce (checkout) e fases restantes do WhatsApp (3.3/3.4 conforme roadmap do projeto).
- Observabilidade com mÃ©tricas de negÃ³cio (taxa de conversÃ£o, pedidos, erro por endpoint).

---

## 12) Onboarding para novo dev (checklist rÃ¡pido)
### 12.1 Dev (local)
- Ler:
  - `docs/LEGADO/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
  - `COMO-INICIAR-AMBIENTE.md`
- Rodar:
  - `.\DEV-RODAR-TUDO.ps1`
  - `cd backend; npm run start:dev`
  - `cd frontend; npm run dev`

### 12.2 ProduÃ§Ã£o (VPS)
- Acesso SSH como `ubuntu` (nÃ£o root)
- Entender:
  - `deploy/README-PRODUCAO.md`
  - scripts em `deploy/scripts/`
- Saber fazer:
  - subir serviÃ§os (`docker compose ... up -d`)
  - ler logs (`docker logs ...`)
  - rodar backup/restore de teste
  - checar health endpoints
---

## Atualizacao (tenant/auth)

- Em producao, o tenant vem somente do JWT.
- Em dev/test, `x-tenant-id` pode ser aceito quando `ALLOW_TENANT_FROM_REQUEST=true`.
- O login nao deve depender de header em producao.



