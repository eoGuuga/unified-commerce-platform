# Relatório completo (Projeto + Operação) — UCM / Unified Commerce Platform
> **Objetivo:** documentar, em um único lugar, **tudo o que existe no projeto** (o que já estava pronto antes), **tudo o que foi melhorado/automatizado** durante a fase de “perfeição” (segurança, multi-tenant/RLS, deploy e hardening), **o estado atual**, e **o que falta fazer** (com ordem recomendada).
>
> **Este documento é propositalmente “end-to-end”**: produto → arquitetura → banco → segurança → deploy → operação → testes → backlog.
>
> **Base de verdade adicional:** este repositório já possui uma documentação extensa. Este relatório **consolida** e aponta para os documentos originais quando o detalhamento já existe.

---

## Ambiente e identificadores (sem segredos)
> **Importante:** este bloco **não** deve conter senhas/keys. É apenas referência operacional.

### Produção (VPS)
- **Servidor/VPS**: OVHcloud (Ubuntu)
- **IP público (VPS)**: `37.59.118.210` *(atual no momento desta fase)*
- **Hostname (VPS)**: `vps-0e3446f6.vps.ovh.net` *(referência operacional)*
- **Path do projeto no servidor**: `/opt/ucm`
- **Serviços (Docker)**:
  - `ucm-nginx` (publica 80)
  - `ucm-frontend` (interno 3000)
  - `ucm-backend` (interno 3001)
  - `ucm-postgres` (interno 5432)
  - `ucm-redis` (interno 6379)
- **UFW (produção)**: liberado 22/80; **443 fechado** até ativar HTTPS.

### Domínio
- **Domínio escolhido**: `gtsofthub.com.br`
- **Status DNS**: no Registro.br pode ficar “em transição” nas primeiras horas (normal).

---

## Sumário
- [1) Contexto e visão do produto](#1-contexto-e-visão-do-produto)
- [2) O que já existia no projeto (antes desta fase)](#2-o-que-já-existia-no-projeto-antes-desta-fase)
- [3) O que foi feito nesta fase (perfeição: produção + segurança + robustez)](#3-o-que-foi-feito-nesta-fase-perfeição-produção--segurança--robustez)
- [4) Arquitetura atual (monorepo + serviços + rede)](#4-arquitetura-atual-monorepo--serviços--rede)
- [5) Multi-tenancy e isolamento por RLS (PostgreSQL)](#5-multi-tenancy-e-isolamento-por-rls-postgresql)
- [6) Segurança: aplicação, proxy e servidor](#6-segurança-aplicação-proxy-e-servidor)
- [7) Deploy e operação (produção VPS)](#7-deploy-e-operação-produção-vps)
- [8) Backups e restore (runbook)](#8-backups-e-restore-runbook)
- [9) Testes e “gates” de qualidade](#9-testes-e-gates-de-qualidade)
- [10) Domínio e HTTPS (gtsofthub.com.br)](#10-domínio-e-https-gtsofthubcombr)
- [11) O que falta fazer (backlog priorizado)](#11-o-que-falta-fazer-backlog-priorizado)
- [12) Onboarding para novo dev (checklist rápido)](#12-onboarding-para-novo-dev-checklist-rápido)

---

## Linha do tempo (resumo factual)
> Um “mapa” do que aconteceu na prática, em ordem aproximada.

### Base do projeto (antes desta fase)
- Estrutura monorepo + docs extensas já presentes.
- Fases do produto descritas e com partes já implementadas (PDV, módulos do backend, Bot WhatsApp 3.1/3.2 etc.).

### Fase “perfeição” (produção + hardening + RLS efetivo)
- Compra/configuração do VPS e deploy em `/opt/ucm`.
- Correção de problemas de **CRLF → LF** em scripts e `deploy/env.prod` (para permitir `bash`/`source` corretamente).
- Ajustes para build/deploy:
  - correção TypeScript em `DbContextService.getRepository<T extends ObjectLiteral>()`
  - correção de migration (índice com `NOW()` → removido do predicate)
  - correção do Dockerfile do frontend (remover `COPY /public` inexistente)
- Subida do compose de produção + migrations + criação do user `ucm_app` (sem superuser).
- Implementação/ativação do RLS por request com `TenantDbContextInterceptor` e `AsyncLocalStorage`.
- Hardening do servidor:
  - UFW restritivo (22/80)
  - unattended-upgrades
  - fail2ban (sshd)
  - rotinas de backup + logs
- Observabilidade/auto-recuperação (no VPS):
  - Netdata bound em localhost + SSH tunnel
  - watchdog (systemd timer) + logrotate
- Domínio definido (`gtsofthub.com.br`) e iniciado o processo de DNS/HTTPS (pendente finalizar).

---

## 1) Contexto e visão do produto
**Nome do produto:** Unified Commerce Platform (UCM)  
**Tipo:** SaaS multi-tenant (múltiplas lojas/negócios)  
**Problema central:** *overselling* ao vender em múltiplos canais sem sincronização.  
**Solução:** backend centralizado com transações ACID, reserva de estoque e automação (WhatsApp Bot).

**Três faces do produto**
- **PDV Web** (tablet/loja física)
- **E-commerce** (storefront)
- **WhatsApp Bot** (atendimento + pedidos + automações)

**Documentos-base (produto)**
- `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
- `docs/INDICE-DOCUMENTACAO.md`

---

## 2) O que já existia no projeto (antes desta fase)
O repositório já vinha com uma base bem completa (produto + código + docs).

### 2.1 Estrutura e stack
- **Monorepo**
  - `backend/`: NestJS + TypeScript + TypeORM
  - `frontend/`: Next.js (App Router) + React + Tailwind
  - `scripts/`: migrations SQL e automações
  - `docs/`: documentação extensa e organizada
- **Infra local (dev):** Docker (Postgres + Redis) + scripts em PowerShell

### 2.2 Funcionalidades já descritas/implementadas
(conforme README e Documento Mestre)
- **Backend**: Auth (JWT), Products, Orders, WhatsApp, Health, Tenants; rate limiting; audit log; idempotência; cache.
- **Frontend**: PDV funcional; Admin/Dashboard; base de e-commerce.
- **WhatsApp Bot**: FASE 3.1 e 3.2 concluídas (respostas + pedidos simples), com NLP pt-BR.
- **Banco**: schema completo; migrations; índices; RLS “habilitado” (complementado e tornado **efetivo** nesta fase).

**Referências**
- `README.md`
- `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
- `COMO-INICIAR-AMBIENTE.md`

---

## 3) O que foi feito nesta fase (perfeição: produção + segurança + robustez)
Esta fase focou em **tornar o sistema vendável/operável** com um padrão de produção: isolamento multi-tenant real, deploy em VPS, hardening do servidor, observabilidade e rotinas operacionais.

### 3.1 Produção em 1 VPS (Docker Compose + Nginx)
- **Alvo:** 1 VPS Ubuntu rodando `nginx`, `frontend`, `backend`, `postgres`, `redis` via `deploy/docker-compose.prod.yml`.
- **Proxy reverso:** Nginx na frente (porta 80), roteando:
  - `/` → `frontend`
  - `/api/*` → `backend`

Arquivos principais:
- `deploy/docker-compose.prod.yml`
- `deploy/nginx/ucm.conf`
- `deploy/env.prod.example` (modelo)
- `deploy/README-PRODUCAO.md`

### 3.2 Multi-tenant “de verdade” (RLS realmente aplicado)
Foram implementados mecanismos para garantir que **todas as queries do app** executem com o `tenant_id` correto, e que o Postgres aplique o isolamento por RLS sem “bypass”.

**Pilares**
- **Usuário do app sem superuser** (em produção): evita bypass de RLS.
  - Script: `deploy/scripts/provision-db-user.sh`
- **Tenant context por request**: abre transação e executa `SET LOCAL app.current_tenant_id = <tenant>`
  - Interceptor: `backend/src/common/interceptors/tenant-db-context.interceptor.ts`
- **EntityManager request-scoped** com `AsyncLocalStorage`: garante que os repositórios usem o manager transacional correto
  - `backend/src/modules/common/services/db-context.service.ts`

### 3.3 Correções de build e robustez de deploy
- **Migrations fail-fast**: `psql -v ON_ERROR_STOP=1` no deploy (para falhar no primeiro erro).
  - `deploy/scripts/run-migrations.sh`
  - `deploy/scripts/provision-db-user.sh`
- **Migration 001 corrigida** para remover predicado com `NOW()` em índice (Postgres exige IMMUTABLE em predicate de índice parcial).
- **Frontend Dockerfile** ajustado para não copiar `/public` inexistente.
  - `frontend/Dockerfile`

### 3.4 Segurança em produção (aplicação + Nginx)
- **Swagger em produção**: desativado por padrão via env e também protegido no Nginx.
  - `ENABLE_SWAGGER=false` no `deploy/env.prod`
  - Nginx bloqueia `/api/docs` e `/api/docs-json` externamente (só local/Docker).
  - `backend/src/main.ts` (toggle via `ENABLE_SWAGGER`)
  - `deploy/nginx/ucm.conf` (restrição de acesso)

### 3.5 Hardening do servidor (VPS)
Automatizações e configuração “mínimo seguro”:
- UFW liberando apenas **22 e 80** (443 fica fechado até SSL)
- `unattended-upgrades` habilitado
- `fail2ban` (jail sshd)
- permissões de `deploy/env.prod` como root-only
- cron de backup diário com log

Script:
- `deploy/scripts/post-deploy-hardening.sh`

### 3.6 Operação e observabilidade
Implantado no servidor (runbook, fora do repo):
- **Netdata** bound em `127.0.0.1` (acesso via SSH tunnel)
- **Watchdog** (`ucm-watchdog.sh` + systemd timer) para healthcheck e auto-recuperação
- **logrotate** para logs do watchdog e backup
- **Log rotation** dos containers via `logging: json-file` no compose

### 3.7 Inventário do que mudou nesta fase (arquivos)
> Lista objetiva para auditoria/revisão.

**Backend (NestJS)**
- `backend/src/common/interceptors/tenant-db-context.interceptor.ts` — contexto do tenant por request + transação + `set_config('app.current_tenant_id', ...)`.
- `backend/src/modules/common/services/db-context.service.ts` — `AsyncLocalStorage` + `runWithManager()` + `getRepository<T extends ObjectLiteral>()`.
- `backend/src/main.ts` — Helmet/CORS mais restritivos; Swagger condicionado a `ENABLE_SWAGGER`.
- `backend/src/app.module.ts` — interceptor aplicado globalmente (`APP_INTERCEPTOR`) + throttler guard.

**Banco (migrations SQL)**
- `scripts/migrations/001-initial-schema.sql` — correção de índice (predicate com `NOW()` removido).
- `scripts/migrations/008-usuarios-email-unique-por-tenant.sql` — unicidade de e-mail por tenant.
- `scripts/migrations/009-rls-force-and-extra-policies.sql` — reforço e políticas extras de RLS.
- `scripts/migrations/010-idempotency-unique-tenant-operation.sql` — idempotência única por tenant/operação.

**Produção / Deploy**
- `deploy/docker-compose.prod.yml` — logging com rotação + `init: true` + `ENABLE_SWAGGER` por env.
- `deploy/nginx/ucm.conf` — proxy + headers + bloqueio externo do Swagger + timeouts.
- `deploy/env.prod.example` — inclui `ENABLE_SWAGGER=false`.
- `deploy/scripts/run-migrations.sh` — `psql` com `ON_ERROR_STOP=1`.
- `deploy/scripts/provision-db-user.sh` — `psql` com `ON_ERROR_STOP=1` + grants mínimos para `ucm_app`.
- `deploy/scripts/backup-postgres.sh` — backup diário + rotação.
- `deploy/scripts/post-deploy-hardening.sh` — UFW/cron/unattended-upgrades/fail2ban/permissões.

**Frontend**
- `frontend/Dockerfile` — ajuste para build de produção sem `public/` inexistente.

---

## 4) Arquitetura atual (monorepo + serviços + rede)
### 4.1 Componentes
- **Frontend:** Next.js (porta interna 3000)
- **Backend:** NestJS (porta interna 3001, prefixo `/api/v1`)
- **PostgreSQL:** 15 (porta interna 5432)
- **Redis:** 7 (porta interna 6379)
- **Nginx:** 80 público → proxy para frontend/backend

### 4.2 Configuração de produção (Docker Compose)
- Arquivo: `deploy/docker-compose.prod.yml`
- Variáveis principais:
  - `FRONTEND_URL` (CORS e ambiente do frontend)
  - `JWT_SECRET`, `ENCRYPTION_KEY`
  - `POSTGRES_PASSWORD`, `DB_APP_USER`, `DB_APP_PASSWORD`
  - `REDIS_PASSWORD`
  - `ENABLE_SWAGGER` (default false)

---

## 5) Multi-tenancy e isolamento por RLS (PostgreSQL)
### 5.1 Como o isolamento funciona
1. Cada tabela “de negócio” tem `tenant_id`.
2. O Postgres aplica **Row Level Security** com policies usando uma variável de sessão:
   - `app.current_tenant_id`
3. A cada request HTTP, quando o tenant está presente, o backend:
   - abre transação
   - executa `SELECT set_config('app.current_tenant_id', $tenantId, true)` (SET LOCAL)
   - executa toda a request com o `EntityManager` daquela transação (via `DbContextService`)

Arquivos-chave:
- `backend/src/common/interceptors/tenant-db-context.interceptor.ts`
- `backend/src/modules/common/services/db-context.service.ts`
- migrations em `scripts/migrations/009-rls-force-and-extra-policies.sql`

### 5.2 Fonte do tenantId
Ordem:
1. `req.user.tenant_id` (JWT já autenticado)
2. Header `x-tenant-id`
3. Body (`tenantId` / `tenant_id`)

### 5.3 Regras importantes (decisão operacional)
- **Produção deve usar DB user do app sem superuser** (ex.: `ucm_app`).  
  Superuser pode bypassar RLS.
- **Login exige tenant** (header `x-tenant-id`) para evitar autenticar “fora de tenant”.

---

## 6) Segurança: aplicação, proxy e servidor
### 6.1 Aplicação (backend)
- **Helmet** com CSP/COEP mais restritos em produção quando Swagger está desligado.
- **CORS**: em produção exige `FRONTEND_URL` e bloqueia origens desconhecidas.
- **Rate limiting** global + “strict” para rotas sensíveis.
  - `backend/src/app.module.ts` (Throttler)
- **Swagger**: somente se `ENABLE_SWAGGER=true` (e mesmo assim, Nginx bloqueia externo).
  - `backend/src/main.ts`

### 6.2 Proxy (Nginx)
- Headers básicos de segurança.
- Timeouts de proxy (evita travas em upstream).
- Bloqueio externo de `/api/docs` e `/api/docs-json`.
  - `deploy/nginx/ucm.conf`

### 6.3 Servidor (VPS)
- UFW, unattended upgrades, fail2ban, SSH hardening (PermitRootLogin no, limites de tentativas/sessões).
- Rotinas de backup e logs.

---

## 7) Deploy e operação (produção VPS)
### 7.1 “Fonte de verdade” do deploy
Leia e siga:
- `deploy/README-PRODUCAO.md`

### 7.2 Ordem recomendada (produção)
1. Preparar VPS (Docker + UFW): `deploy/scripts/prod-setup-ubuntu.sh`
2. Criar `deploy/env.prod` a partir do exemplo
3. Subir `postgres` + `redis`
4. Rodar migrations: `deploy/scripts/run-migrations.sh`
5. Criar usuário do app (RLS real): `deploy/scripts/provision-db-user.sh`
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
- Cron sugerido (03:00 diário) com log:

```bash
0 3 * * * cd /opt/ucm && bash deploy/scripts/backup-postgres.sh >> /opt/ucm/backups/backup.log 2>&1
```

### 8.2 Restore de teste (padrão recomendado)
Observação crítica: `pg_dump` **não inclui roles**. Se o dump referencia `ucm_app`, o restore deve criar a role antes.

Checklist (conceitual):
- subir um postgres temporário
- criar role(s) referenciadas
- restaurar dump
- sanity-check de contagens (tenants/usuarios/produtos)

---

## 9) Testes e “gates” de qualidade
### 9.1 Ambiente dev (Windows)
Documento: `docs/07-setup/COMO-INICIAR-AMBIENTE.md`

Script “faz-tudo” (dev):
- `scripts/DEV-RODAR-TUDO.ps1` (inicia containers, aplica migrations, garante user do app sem superuser, etc.)

### 9.2 E2E (WhatsApp / FASE 3.3)
- Script: `scripts/test/test-fase-3-3-e2e.ps1`
- Ele já inclui retentativas para rate-limit (429) e tenta garantir migrations críticas quando docker está disponível.

### 9.3 Gates recomendados antes de “vender”
- `npm run lint`
- `npm run build`
- `npm run test` (unit/integration)
- E2E (principalmente WhatsApp + Orders)
- Smoke tests em produção (health + login + 1 fluxo de pedido)

---

## 10) Domínio e HTTPS (gtsofthub.com.br)
### 10.1 Situação
- Domínio escolhido: **`gtsofthub.com.br`**
- DNS no Registro.br pode ficar em “transição” (normal nas primeiras horas).

### 10.2 O que falta (DNS)
Quando a zona DNS liberar, criar:
- **A** `@` → IP do VPS
- **A** `www` → IP do VPS

Depois validar propagação (do seu PC):
- `nslookup gtsofthub.com.br`
- `nslookup www.gtsofthub.com.br`

### 10.3 O que falta (HTTPS)
Somente após DNS apontar:
- liberar 443 no UFW
- emitir certificado (Let’s Encrypt)
- ajustar Nginx para 443 e redirect 80→443
- atualizar `FRONTEND_URL` para `https://gtsofthub.com.br`

---

## 11) O que falta fazer (backlog priorizado)
### 11.1 Crítico (para produção “comercial”)
- **DNS + HTTPS** para `gtsofthub.com.br` (fechar o ciclo com 443).
- **Onboarding de segundo dev** com acesso seguro ao VPS (ideal: chaves SSH; se insistir em senha, reforçar políticas e 2FA onde possível).
- **Runbook formal de incidentes** (SLA, checklist de quedas, rollback, restore).

### 11.2 Alto
- **CI/CD mínimo** (build + lint + tests + build docker em pipeline).
- **Alertas** (Netdata/health): avisar no WhatsApp/Email quando cair.
- **Rotina de update** (janela mensal, atualização docker images, revisão de logs).

### 11.3 Médio
- Evoluir e-commerce (checkout) e fases restantes do WhatsApp (3.3/3.4 conforme roadmap do projeto).
- Observabilidade com métricas de negócio (taxa de conversão, pedidos, erro por endpoint).

---

## 12) Onboarding para novo dev (checklist rápido)
### 12.1 Dev (local)
- Ler:
  - `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
  - `COMO-INICIAR-AMBIENTE.md`
- Rodar:
  - `.\DEV-RODAR-TUDO.ps1`
  - `cd backend; npm run start:dev`
  - `cd frontend; npm run dev`

### 12.2 Produção (VPS)
- Acesso SSH como `ubuntu` (não root)
- Entender:
  - `deploy/README-PRODUCAO.md`
  - scripts em `deploy/scripts/`
- Saber fazer:
  - subir serviços (`docker compose ... up -d`)
  - ler logs (`docker logs ...`)
  - rodar backup/restore de teste
  - checar health endpoints

