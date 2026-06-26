# CLAUDE.md — Guia operacional para sessoes com Claude Code

Leitura obrigatoria antes de mexer em codigo. Orienta agentes Claude e devs novos no UCM/GTSoftHub.
Detalhes longos vivem em docs referenciados (carregados sob demanda) para manter este arquivo enxuto.

---

## 0. Acordo de trabalho (como o Claude deve operar)

Este projeto e um **SaaS comercial real** em producao, com dados de clientes e pagamentos.
Erro aqui = prejuizo financeiro, vazamento de dados ou processo judicial. Trabalhe nesse nivel.

**Principios (em ordem de prioridade):**
1. **Seguranca e conformidade legal acima de velocidade.** Nunca introduza fail-open, secret hardcoded, ou endpoint sem auth. Em duvida, escolha o caminho mais seguro e avise.
2. **Eficiencia de tokens.** Leia so o que precisa (use `offset`/`limit`, Grep com escopo). Para varreduras amplas, despache um subagente `Explore` e fique com a conclusao, nao com o dump. Nao releia arquivos que acabou de editar. Nao narre o que nao vai fazer.
3. **Profissionalismo de alto nivel.** Codigo que se parece com o codigo ao redor. Sem giria, sem solucao "provisoria" que vira divida. Se algo esta errado na base, diga — nao replique o erro.
4. **Honestidade de resultado.** Se um teste falhou, diga com a saida. Se pulou um passo, diga. "Funciona" so depois de verificar.

**Antes de dar por concluida qualquer tarefa (Definition of Done):**
- [ ] `cd backend && npm run build` passa.
- [ ] Lint sem novos erros nos arquivos tocados.
- [ ] Nenhum secret, PII ou credencial em codigo/commit/log.
- [ ] Se mexeu em rota publica/webhook: continua idempotente e com verificacao de assinatura.
- [ ] Mudanca de comportamento publico refletida em `docs/CONSOLIDADO/`.

**O que SEMPRE perguntar antes de fazer** (acoes dificeis de reverter):
- Deploy em producao, rodar migration destrutiva, apagar/sobrescrever dados, push forcado, expor algo novo na internet, enviar dados a servico externo.

---

## 1. Visao geral

**Unified Commerce Platform (UCM)** — marca comercial **GTSoftHub**.
SaaS omnichannel multi-tenant: vendas via **WhatsApp + PDV + loja online**, estoque consistente e pagamentos integrados.
Cada cliente do SaaS conecta o **proprio numero** de WhatsApp (Evolution API via QR Code) — o bot nunca usa o numero do dono da plataforma em producao.

- Producao: https://gtsofthub.com.br (stack em `/opt/ucm`)
- DEV/TESTE: https://dev.gtsofthub.com.br (stack em `/opt/ucm-test-repo`)
- Solo dev, deploy manual via SSH. CI em `.github/workflows/` faz lint/build/test; deploy ainda e manual.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 11 + TypeORM 0.3 + class-validator + zod |
| Banco | PostgreSQL 15 (multi-tenant via **RLS**) |
| Cache | Redis 7 (cache + idempotency keys + sessao) |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind 4 + Radix UI |
| Auth | JWT + bcryptjs + cookie-parser + CSRF guard |
| Pagamentos | Mercado Pago SDK 2.x + mock PIX fallback (so dev) |
| WhatsApp | Twilio **ou** Evolution API (`WHATSAPP_PROVIDER`) |
| IA | OpenAI **ou** Ollama (`OPENAI_BASE_URL`) — o bot e hibrido: handlers rapidos + fallback de IA |
| Proxy/SSL | Nginx + Let's Encrypt |

---

## 3. Invariantes criticos (NAO QUEBRAR)

1. **Multi-tenancy via Row-Level Security (RLS).** Isolamento NAO e `WHERE tenant_id = ?`. O `TenantDbContextInterceptor` faz `SELECT set_config('app.current_tenant_id', $1, true)` por request. Queries com tenant rodam dentro do `DbContextService`. Webhooks publicos extraem o tenant manualmente ANTES de tocar repositorios.
2. **Idempotencia em POSTs criticos.** `POST /orders` e `POST /payments` aceitam `Idempotency-Key` (Redis + Postgres, TTL >= 24h). Webhooks de pagamento tambem devem deduplicar retries por `request_id`.
3. **`synchronize: false` no TypeORM.** Schema so muda via migration explicita. NUNCA habilitar synchronize.
4. **`JWT_SECRET` e `ENCRYPTION_KEY` obrigatorios em prod** (min 32 chars; falha boot se faltar).
5. **`SEED_DEV_USER` bloqueado em producao** (erro no `main.ts`).
6. **Verificacao de assinatura de webhook obrigatoria em producao.** Se o secret nao estiver configurado em prod, o webhook deve **falhar fechado** (rejeitar), nunca aceitar sem verificar.
7. **Sem IA inventando dados de negocio.** Preco, estoque e status sempre vem do banco, nunca do LLM.

---

## 4. Seguranca e LGPD (resumo — detalhe em `docs/CONSOLIDADO/05-SEGURANCA-COMPLIANCE.md`)

Este SaaS processa PII e pagamentos de terceiros. Conformidade nao e opcional — e protecao contra multa (LGPD: ate 2% do faturamento) e processo.

**Regras inviolaveis:**
- **Zero secrets em codigo ou git.** Apenas `.env` (gitignored) e GitHub Secrets. `.env.example` so com placeholders. Nada de fallback de senha real em `docker-compose` — usar `${VAR:?obrigatorio}` em prod.
- **Fail-closed sempre.** Auth, webhook e validacao de assinatura rejeitam quando o segredo falta. Nunca `if (secret) verifica`.
- **Sem endpoint de teste/debug exposto em prod** (`/whatsapp/test`, `/whatsapp/metrics` sem guard, etc.).
- **PII so via servicos com audit log + criptografia** (`ENCRYPTION_KEY`). Nunca logar telefone, CPF, token ou conteudo de pagamento.
- **LGPD obrigatorio antes de cliente real:** consentimento registrado, exclusao de dados real (nao stub), politica de privacidade + termos, retencao definida.

**Pendencias conhecidas de seguranca/LGPD** (rastreadas no backlog — ver doc): exclusao de dados ainda e stub; falta fluxo de consentimento e paginas legais; alguns endpoints com auth opcional em dev.

---

## 5. Fluxo de trabalho (Scrum leve para solo dev)

- **Sprints curtas e tarefas pequenas.** Use TodoWrite para quebrar e rastrear. Uma tarefa = um objetivo verificavel.
- **Branch por tarefa.** Nunca commitar direto na `main` para mudanca nao-trivial. `feat/...`, `fix/...`, `chore/...`.
- **Commits: Conventional Commits, em INGLES, curtos e atomicos.**
  - Formato: `tipo(escopo): descricao no imperativo` — ex.: `feat(whatsapp): add interactive buttons provider`, `fix(payments): make webhook signature mandatory in prod`.
  - Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `security`.
  - **Nunca** colocar secret, PII, URL interna ou IP de servidor na mensagem.
- **Codigo e comentarios permanecem em portugues** (alinhado a base existente; reescrever 16k linhas seria churn e risco). So commits e descricoes de PR em ingles.
- **PR description:** o que muda, por que, como testar, riscos. Em ingles.
- **Definition of Done:** ver secao 0.

---

## 6. Estrutura

```
backend/                 NestJS API
  src/modules/           auth, products, orders, payments, whatsapp, lgpd,
                         notifications, coupons, tenants, health
  src/common/            decorators, filters, guards, interceptors,
                         services (cache, audit, db-context, encryption, idempotency)
  src/database/          entities + dataSource + migrations
  src/main.ts            bootstrap, CORS, helmet, swagger gated, seed dev
frontend/                Next.js App Router (/, /login, /loja, /pdv, /pedido, /admin, /info/[slug])
deploy/                  docker-compose.{prod,dev,test}.yml, nginx/ucm.conf, scripts/, env.*.example
docs/CONSOLIDADO/        doc oficial atual (use estes!)  |  docs/LEGADO/ historico, nao usar
```

**Arquivos com divida tecnica conhecida (nao adicionar responsabilidade):**
- `backend/src/modules/whatsapp/whatsapp.service.ts` — monolito grande; quebrar em Conversation/Message/Sales.
- `frontend/app/{loja,pdv,pedido,admin}/page.tsx` — `'use client'` gigantes; decompor.
- `backend` e `frontend/lib/api-client.ts` — excesso de `any`; tipar por endpoint.
- Sem testes no frontend; sem e2e no backend.

---

## 7. Comandos uteis

### Backend
```bash
cd backend
npm run start:dev          # watch
npm run build              # tsc -> dist/
npm run test:unit
npm run test:integration
npm run lint
npm run migration:show     # lista pendentes
npm run migration:run      # aplica
npm run migration:generate -- src/database/migrations/Nome
```

### Frontend
```bash
cd frontend
npm run dev | npm run build | npm run lint | npm run type-check
```

### Servidor (VPS, via SSH `ubuntu@gtsofthub.com.br`)
```bash
cd /opt/ucm
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs -f backend
bash deploy/scripts/apply-and-health.sh   # deploy + health check
bash deploy/scripts/backup-postgres.sh    # backup manual
```

---

## 8. Webhooks (PUBLICOS, no auth de usuario)

| Endpoint | Provider | Auth |
|---|---|---|
| `POST /api/v1/payments/webhook/mercadopago` | Mercado Pago | `x-signature` (HMAC) + `?token=` |
| `POST /api/v1/whatsapp/webhook` | Twilio / Evolution | assinatura especifica do provider |

Ambos: `@Public()`, `@Throttle({ webhook: { ttl: 60s, limit: 60 } })`, nginx zone `api_webhook` (5 r/s, burst 10), **idempotentes**, e **fail-closed** se o secret nao estiver configurado em producao.

---

## 9. Variaveis de ambiente criticas

| Var | Obrigatoria | Notas |
|---|---|---|
| `JWT_SECRET` | sempre, min 32 | falha boot se ausente em prod |
| `ENCRYPTION_KEY` | sempre, min 32 | PII no audit log |
| `DATABASE_URL` | sempre | inclui pwd; nao logar |
| `REDIS_URL` | sempre | `redis://:senha@host:port` |
| `FRONTEND_URL` | prod | CORS allowlist |
| `SEED_DEV_USER` | nunca em prod | bloqueio no main.ts |
| `MERCADOPAGO_ACCESS_TOKEN` | prod c/ pagamento real | `TEST-*` em dev |
| `MERCADOPAGO_WEBHOOK_TOKEN` | prod | webhook fail-closed sem ele |
| `WHATSAPP_PROVIDER` | sempre | `twilio` ou `evolution` |
| `WHATSAPP_WEBHOOK_SECRET` | prod | webhook fail-closed sem ele |
| `PIX_KEY` | prod c/ PIX | falhar boot se mock em prod |

Exemplos: `deploy/env.prod.example`, `deploy/env.dev.example`.

---

## 10. Antes de PR / deploy

1. `cd backend && npm run lint && npm run build && npm run test:unit` — tem que passar.
2. `cd frontend && npm run lint && npm run type-check && npm run build` — tem que passar.
3. Mexeu em migration? Rodou em dev (`npm run migration:run`)?
4. Mexeu em webhook? Idempotente, fail-closed, rate-limit ok, testou retry?
5. Nenhum secret/PII em diff, commit ou log?
6. Atualizou `docs/CONSOLIDADO/` se mudou comportamento publico?
