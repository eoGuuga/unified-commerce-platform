# CLAUDE.md - Guia para sessoes com Claude Code

Este arquivo orienta agentes Claude (e devs novos) ao trabalhar no UCM/GTSoftHub.
Leitura obrigatoria antes de mexer em codigo. Outros docs: `docs/CONSOLIDADO/`.

## Visao geral

**Unified Commerce Platform (UCM)** - marca comercial **GTSoftHub**.
SaaS omnichannel: vendas via **WhatsApp + PDV + loja online** com estoque consistente e pagamentos integrados.

- Producao: https://gtsofthub.com.br (stack em `/opt/ucm`)
- DEV/TESTE: https://dev.gtsofthub.com.br (stack em `/opt/ucm-test-repo`)
- Solo dev, deploy manual via SSH. **Nao existe CI/CD ate o momento desta nota** (workflows em `.github/workflows/` foram adicionados, mas ainda nao executam deploy).

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 11 + TypeORM 0.3 + class-validator + zod |
| Banco | PostgreSQL 15 (multi-tenant via **RLS**) |
| Cache | Redis 7 (cache + idempotency keys + sessao) |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind 4 + Radix UI |
| Auth | JWT + bcryptjs + cookie-parser + CSRF guard |
| Pagamentos | Mercado Pago SDK 2.x + mock PIX fallback |
| WhatsApp | Twilio **ou** Evolution API (`WHATSAPP_PROVIDER`) |
| IA | OpenAI **ou** Ollama (`OPENAI_BASE_URL`) |
| Proxy/SSL | Nginx + Let's Encrypt |
| Logging | json-file driver (limite 10m/5 files) |

## Invariantes criticos (NAO QUEBRAR)

1. **Multi-tenancy via Row-Level Security (RLS)**.
   - Tenant isolation NAO eh feito com `WHERE tenant_id = ?` em queries.
   - O `TenantDbContextInterceptor` executa `SELECT set_config('app.current_tenant_id', $1, true)` dentro de cada request transactional.
   - Toda query que precisa de tenant context tem que rodar dentro do `DbContextService` ou de um query runner com a session variable setada.
   - Webhook publicos (Mercado Pago, WhatsApp) precisam extrair o tenant manualmente ANTES de tocar repositorios.

2. **Idempotencia em POSTs criticos**.
   - `POST /orders` e `POST /payments` aceitam header `Idempotency-Key`.
   - Tabela `idempotency_key` armazena o resultado em Redis + Postgres.
   - Nao remover, nao reduzir TTL abaixo de 24h.

3. **`synchronize: false` no TypeORM**.
   - Schema so muda via migration explicita. NUNCA habilitar synchronize.
   - Migrations sao geradas/rodadas via `npm run migration:*` no backend.

4. **JWT_SECRET e ENCRYPTION_KEY obrigatorios em prod**.
   - Validacao no startup: minimo 32 chars. Falha boot se faltar.

5. **SEED_DEV_USER bloqueado em producao**.
   - `backend/src/main.ts` lanca erro se `NODE_ENV=production` + `SEED_DEV_USER=true`.

6. **Idioma**: codigo, docs, commits, comentarios - tudo em **portugues**.
   - Excecao: mensagens de commit seguem Conventional Commits em ingles curto (`feat(...)`, `fix(...)`).

## Estrutura

```
.
├── backend/                 NestJS API
│   ├── src/
│   │   ├── modules/         auth, products, orders, payments, whatsapp,
│   │   │                    notifications, coupons, tenants, health
│   │   ├── common/          decorators (CurrentTenant, Public), filters,
│   │   │                    guards (CsrfGuard, JwtAuthGuard), interceptors,
│   │   │                    services (cache, audit, db-context, encryption,
│   │   │                    idempotency)
│   │   ├── database/        entities + dataSource + migrations (vazia agora)
│   │   ├── main.ts          bootstrap, CORS, helmet, swagger gated, seed dev
│   │   └── app.module.ts    Throttler (default/strict/webhook), modules
│   ├── scripts/             seed wrappers, acid tests, whatsapp evals
│   └── jest.config.js
│
├── frontend/                Next.js App Router
│   ├── app/                 / | /login | /loja | /pdv | /pedido |
│   │                        /admin | /admin/estoque | /info/[slug]
│   ├── components/          ui/ (Radix wrappers), landing/, ErrorBoundary
│   ├── lib/                 api-client (axios), config, useAuth hook
│   └── next.config.js       images optimizadas em prod
│
├── deploy/
│   ├── docker-compose.prod.yml   producao (postgres, redis, backend, frontend, nginx)
│   ├── docker-compose.dev.yml    dev VPS (postgres+redis na porta 5433/6380)
│   ├── docker-compose.test.yml   homolog
│   ├── docker-compose.evolution.test.yml  Evolution API standalone
│   ├── nginx/ucm.conf            rate limiting + SSL + restricao /api/docs
│   ├── scripts/                  backup-postgres.sh, backup-offsite.sh,
│   │                             apply-and-health.sh, restore-drill, etc.
│   └── env.*.example             templates de .env (prod, dev, evolution)
│
├── docs/
│   ├── CONSOLIDADO/         doc oficial atual (use estes!)
│   └── LEGADO/              doc antiga, NAO usar para operacao
│
├── scripts/                 dev/, ops/, migrations/, seeds/, test/
└── config/docker-compose.yml  dev local (Docker Desktop)
```

## Comandos uteis

### Dev local (Windows + Docker Desktop)
```powershell
.\INICIAR-AMBIENTE.ps1   # sobe postgres + redis em container
.\setup.ps1              # cria DB, roda migrations, seeds
cd backend; npm run start:dev
cd ../frontend; npm run dev
.\test-backend.ps1       # roda jest no backend
```

### Backend
```bash
cd backend
npm run start:dev          # watch mode
npm run build              # tsc -> dist/
npm run test:unit          # jest unit only
npm run test:integration   # jest *.integration.spec.ts
npm run test:acid          # acidez/consistency tests
npm run lint

# Schema/migrations (TypeORM CLI - usa src/database/data-source.ts):
npm run migration:show                  # lista migrations pendentes
npm run migration:run                   # aplica pendentes (cliente novo)
npm run migration:revert                # desfaz a ultima (raro)
npm run migration:create -- src/database/migrations/MinhaMigracao
npm run migration:generate -- src/database/migrations/Nome
# A baseline 1700000000000-BaselineFromSqlMigrations.ts engloba as
# 14 SQLs legadas em scripts/migrations/. Em tenants ja em prod, marcar
# como aplicada: INSERT INTO typeorm_migrations VALUES(1700000000000, 'BaselineFromSqlMigrations1700000000000').
npm run migration:run
```

### Frontend
```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run type-check         # tsc --noEmit
```

### Servidor (VPS)
```bash
cd /opt/ucm                # prod
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs -f backend
bash deploy/scripts/apply-and-health.sh   # deploy + health check
bash deploy/scripts/backup-postgres.sh    # backup manual
```

## Webhooks (PUBLICOS, no auth)

| Endpoint | Provider | Auth method |
|---|---|---|
| `POST /api/v1/payments/webhook/mercadopago` | Mercado Pago | Header `x-signature` (HMAC) + `?token=` query |
| `POST /api/v1/whatsapp/webhook` | Twilio / Evolution | Provider-specific signature |

Ambos:
- Marcados com `@Public()` (passam pelo `JwtAuthGuard`).
- Tem `@Throttle({ webhook: { ttl: 60s, limit: 60 } })` no decorator.
- Nginx aplica zone `api_webhook` (5 req/s, burst 10) por IP.
- Devem ser **idempotentes** - mercado pago re-envia em caso de timeout.

## Variaveis de ambiente criticas

| Var | Quando obrigatoria | Notas |
|---|---|---|
| `JWT_SECRET` | sempre, min 32 chars | falha boot se ausente em prod |
| `ENCRYPTION_KEY` | sempre, min 32 chars | usada para PII em audit log |
| `DATABASE_URL` | sempre | inclui pwd; nao logar |
| `REDIS_URL` | sempre | formato `redis://:senha@host:port` |
| `FRONTEND_URL` | obrigatorio em prod | usado pra CORS allowlist |
| `CORS_ORIGINS` | opcional | extras separados por virgula |
| `SEED_DEV_USER` | nunca em prod | bloqueio explicito no main.ts |
| `MERCADOPAGO_ACCESS_TOKEN` | em prod se pagamento real | usar TEST-* em dev |
| `WHATSAPP_PROVIDER` | sempre | `twilio` ou `evolution` |
| `ENABLE_SWAGGER` | opcional | `false` em prod recomendado |

Exemplos completos em `deploy/env.prod.example` e `deploy/env.dev.example`.

## Arquivos com dividida tecnica conhecida

- **`backend/src/modules/whatsapp/whatsapp.service.ts`** - ~16k linhas, monolito.
  Precisa ser quebrado em `ConversationManager`, `MessageProcessor`, `SalesOrchestrator`.
  Nao adicionar mais responsabilidades neste arquivo.

- **`frontend/app/loja/page.tsx`** (2549 linhas), **`pdv/page.tsx`** (2059),
  **`pedido/page.tsx`** (1357), **`admin/page.tsx`** (1233) - todos `'use client'` gigantes.
  Decompor em subcomponentes em `components/<feature>/`.

- **`frontend/lib/api-client.ts`** - 52 usos de `any`. Tipar por endpoint.
  Backend tem 316 usos de `any` distribuidos.

- **Sem testes no frontend** - jest/vitest nao instalados.

- **Sem testes e2e no backend** - so unit + integration.

## Backup e disaster recovery

- Backup automatico: `deploy/scripts/backup-postgres.sh` (cron diario, retencao 7 dias local).
- Offsite: `deploy/scripts/backup-offsite.sh` -> Backblaze B2 via rclone (retencao 30 dias, criptografado).
- Restore drill: `deploy/scripts/restore-drill-offsite.sh` valida integridade.
- **Falta**: documento explicito de RTO/RPO em `deploy/DISASTER-RECOVERY.md`.

## Notas de seguranca

- Helmet aplicado em todas as respostas (CSP ativo quando swagger off).
- CORS whitelist explicita - dev tem localhost; prod exige FRONTEND_URL.
- CsrfGuard global - rotas publicas usam `@Public()` decorator.
- Nginx: rate limit `api_general` (10 r/s), `api_auth` (1 r/s), `api_webhook` (5 r/s), `conn_per_ip` (50).
- Throttler NestJS: `default` 100/min, `strict` 10/min (login), `webhook` 60/min.
- Senhas: bcryptjs salt 10.
- `/api/docs` e `/api/docs-json` restritos a 127.0.0.1 + 172.16.0.0/12 no nginx.

## Convencoes que importam

- Conventional Commits em ingles curto: `feat(whatsapp): ...`, `fix(payments): ...`, `docs(test): ...`.
- Migrations: nome em PascalCase, prefixo timestamp do typeorm. Ex.: `1737000000000-AddTenantToOrders.ts`.
- Arquivos `whatsapp-sales-evals-results-*.json` e `test-whatsapp-hardening-results-*.json` estao no `.gitignore`. Nao commitar.
- Docs novas em `docs/CONSOLIDADO/`. Nao adicionar em `docs/LEGADO/` (so leitura historica).

## Antes de uma PR / deploy

1. `cd backend && npm run lint && npm run build && npm run test:unit` - tem que passar.
2. `cd frontend && npm run lint && npm run type-check && npm run build` - tem que passar.
3. Se mexeu em migration: rodou em dev? `npm run migration:run`.
4. Se mexeu em webhook: idempotente? rate-limit ok? testou retry?
5. Atualizou `docs/CONSOLIDADO/` se mudou comportamento publico?
