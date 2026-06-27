# CLAUDE.md — Guia operacional (UCM / GTSoftHub)

Leitura obrigatoria antes de tocar codigo. SaaS comercial real em producao com PII e pagamentos.
**Vai mexer em codigo? Pule para o Mapa (sec. 6) primeiro** — saber onde fica cada coisa evita exploracao cega, que e o maior gasto de token. Detalhe longo (seguranca/LGPD) fica em docs referenciados, carregados sob demanda.

---

## 0. Acordo de trabalho (precedencia maxima)

Erro aqui = prejuizo financeiro, vazamento de dados de cliente, ou processo judicial. Opere nesse nivel.

**Principios (em ordem):**
1. **Seguranca e conformidade legal > velocidade.** Nunca introduza fail-open, secret hardcoded, ou endpoint sem auth. Em duvida, caminho mais seguro + avise.
2. **Eficiencia de tokens = acertar de primeira.** O custo nao esta no tamanho deste arquivo; esta em explorar a toa, errar caminho e refazer. Use o Mapa (sec. 6). Leia so o trecho necessario (`offset`/`limit`, Grep com escopo). Varredura ampla -> subagente `Explore`, fique com a conclusao. Nao releia arquivo que acabou de editar. Nao narre o que nao vai fazer.
3. **Profissionalismo.** Codigo que se parece com o vizinho. Sem giria, sem "provisorio" que vira divida. Achou erro na base? Diga — nao replique. **Commits sempre em ingles, Conventional Commits, profissionais (regra detalhada na sec. 5).**
4. **Honestidade de resultado.** Teste falhou: diga com a saida. Pulou passo: diga. "Funciona" so apos verificar.

**Definition of Done (checklist canonico — rodar antes de declarar tarefa pronta E antes de PR/deploy):**
- [ ] `cd backend && npm run build` passa (e `npm run lint` sem novo erro nos arquivos tocados).
- [ ] Mexeu no frontend? `npm run type-check` e `npm run lint` passam.
- [ ] Mexeu em migration? Rodou em dev (`npm run migration:run`)?
- [ ] Zero secret/PII/credencial/IP em codigo, commit, log.
- [ ] Rota publica/webhook tocada? Continua idempotente + fail-closed (retry testado).
- [ ] Comportamento publico mudou? Refletido em `docs/CONSOLIDADO/`.

**Confirmar com o usuario ANTES de** (acoes dificeis de reverter): deploy em prod, migration destrutiva, apagar/sobrescrever dados, push forcado, expor algo novo na internet, enviar dados a servico externo. Aprovacao em um contexto nao vale para o proximo.

---

## 1. Contexto de negocio (1 paragrafo, importa para decisoes)

GTSoftHub e um **SaaS multi-tenant que o dono VENDE para clientes**. Cada cliente conecta o **proprio numero** de WhatsApp (Evolution API via QR Code) e o **proprio MercadoPago/PIX**. O numero/credencial do dono so existe para teste. Implicacao pratica: nada pode ser hardcoded para um tenant; todo recurso e por-tenant e isolado por RLS. Falha de isolamento = um cliente ve dados de outro = fim do negocio.

- Prod: https://gtsofthub.com.br (`/opt/ucm`) | Dev: https://dev.gtsofthub.com.br (`/opt/ucm-test-repo`)
- Solo dev. CI (lint/build/test) roda; **deploy e manual via SSH `ubuntu@gtsofthub.com.br`**.

---

## 2. Stack

Backend: **NestJS 11 + TypeORM 0.3 + Postgres 15 (RLS) + Redis 7**, validacao com **class-validator** (zod esta no package mas NAO e usado em DTOs — nao introduza sem motivo), JWT + bcryptjs + CSRF. `tsconfig` **strict:true** (mas `strictPropertyInitialization:false`). Path aliases: `@/*` (raiz src), `@modules/* @common/* @config/* @database/*`.
Frontend: **Next.js 16 (App Router) + React 19 + Tailwind 4 + Radix**. Testes em **vitest**.
Pagamentos: **Mercado Pago SDK 2.x** + mock PIX (so dev). WhatsApp: **Twilio ou Evolution** (`WHATSAPP_PROVIDER`). IA: **OpenAI ou Ollama** (`OPENAI_BASE_URL`).

---

## 3. Invariantes criticos (NAO QUEBRAR)

1. **Multi-tenancy via RLS** — NAO e `WHERE tenant_id=?`. `TenantDbContextInterceptor` faz `set_config('app.current_tenant_id', $1, true)` por request; queries com tenant rodam no `DbContextService`. Webhooks publicos extraem o tenant manualmente ANTES de tocar repositorio.
2. **Idempotencia** — `POST /orders` e `/payments` aceitam `Idempotency-Key` (Redis+Postgres, TTL >=24h). Webhook de pagamento deduplica retry por `request_id`.
3. **`synchronize:false`** — schema so muda via migration explicita. Nunca habilitar.
4. **`JWT_SECRET` e `ENCRYPTION_KEY`** — min 32 chars, falha boot se faltar (validado em `auth.module.ts` e `common/services/encryption.service.ts`).
5. **`SEED_DEV_USER` bloqueado em prod** (erro no `main.ts`).
6. **Webhook fail-closed em prod** — secret ausente -> rejeita, nunca aceita sem verificar.
7. **IA nunca inventa dado de negocio** — preco, estoque, status sempre do banco. O LLM conversa; o banco decide.

---

## 4. Seguranca e LGPD (detalhe: `docs/CONSOLIDADO/05-SEGURANCA-COMPLIANCE.md`)

Processa PII e pagamento de terceiros. Conformidade protege de multa (LGPD ate 2% do faturamento) e processo.
- **Zero secret em codigo/git.** So `.env` (gitignored) + GitHub Secrets; `.env.example` so placeholder. Sem fallback de senha real em compose (usar `${VAR:?}`). *(Verificado 2026-06-26: `.env` real NAO esta versionado.)*
- **Fail-closed sempre** em auth/webhook/assinatura. Nunca `if (secret) verifica`.
- **Sem endpoint de teste/debug exposto em prod.**
- **PII so via servico com audit log + `ENCRYPTION_KEY`.** Nunca logar telefone/CPF/token/conteudo de pagamento.
- **Pendencias criticas** (backlog no doc, secao Auditoria 2026-06-26): webhooks fail-open, `/whatsapp/test` e `/whatsapp/metrics` sem guard, exclusao LGPD stub, falta consentimento + paginas legais.

---

## 5. Fluxo de trabalho (Scrum leve, solo dev)

- Tarefas pequenas e verificaveis; use **TodoWrite** para quebrar e rastrear.
- **Branch por tarefa** (`feat/`, `fix/`, `chore/`, `security/`, `refactor/`). Nada nao-trivial direto na `main`.
- **Commits SEMPRE em INGLES, profissionais — regra inegociavel** (mesmo conversando em portugues com o usuario):
  - Formato Conventional Commits: `tipo(escopo): imperativo curto` (<=72 chars no titulo). Ex.: `fix(payments): make mercadopago webhook fail-closed`.
  - Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `security`, `perf`.
  - **Atomico**: 1 commit = 1 mudanca logica. Nao misturar refactor com feature.
  - Corpo (quando nao-trivial): explicar o **porque**, nao so o **o que**. Bullets em ingles.
  - **NUNCA** secret, PII, telefone, token, IP de servidor ou URL interna na mensagem.
  - Trailer obrigatorio em commits feitos pelo agente: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Codigo e comentarios permanecem em PORTUGUES** (base inteira e PT; reescrever = churn e risco). So commit, PR e branch em ingles.
- PR description em ingles: o que muda, por que, como testar, riscos.

---

## 6. MAPA — onde fica cada coisa (use isto ANTES de procurar)

```
backend/src/
  main.ts ........................ bootstrap: CORS, helmet, swagger gated, validacao de env, seed gate
  app.module.ts .................. Throttler (default/strict/webhook), modules
  modules/
    auth/ .......................... JWT, login (exige x-tenant-id em prod), guards
    tenants/ ....................... resolucao de tenant; usado por webhooks publicos
    products/ ...................... catalogo, estoque (movimentacoes_estoque)
    orders/ ........................ orders.service.ts (849L) calcula total
    payments/ ...................... payments.service.ts (841L): MercadoPago + PIX + webhook
    whatsapp/ ...................... bot (ver detalhe abaixo)
    coupons/ notifications/ lgpd/ health/
  common/ .......................... decorators (@CurrentTenant, @Public), guards (Csrf, Jwt),
                                     interceptors (TenantDbContext), services (cache, audit,
                                     db-context, encryption, idempotency)
  database/ ........................ entities + data-source.ts + migrations/
frontend/app/ ...................... / login loja pdv pedido checkout assinar admin info/[slug]
deploy/ ............................ docker-compose.{prod,dev,test}.yml, nginx/ucm.conf, scripts/, env.*.example
docs/CONSOLIDADO/ .................. doc oficial (use) | docs/LEGADO/ historico (nao usar)
```

**Bot WhatsApp — arquitetura HIBRIDA (entenda antes de mexer):**
`whatsapp.service.ts` (1584L) e orquestrador, NAO monolito de if/else. Fluxo real de uma mensagem:
1. `processIncomingMessage()` (L107) — ignora grupo/broadcast/bloqueado, exige `tenantId`, valida tenant.
2. `messageProcessor.processMessage()` (L139) — sanitiza, detecta tipo/limite de tamanho.
3. **Fast-path:** handlers diretos (carrinho, catalogo, comando de bot) para comandos obvios.
4. **Caminho de IA (o coracao):** `handleFallback()` (L906) -> `llmRouterService.route()` (L1062) decide a acao -> `actionExecutorService.execute()` (L1071) executa (busca estoque, cria pedido). `openai.service.ts` classifica intencao + entende giria PT-BR.
5. `sendOutboundResponse()` (L278) — **hoje so loga; falta ligar `evolution-api.provider`.**

- ~30 servicos em `whatsapp/services/` (sales-intelligence, conversation-manager, message-intelligence...). Providers em `whatsapp/providers/` (`evolution-api` com botoes/listas, `mock`). Tipos em `whatsapp/types/whatsapp-interactive.types.ts`.
- Frontend tem `lib/api-client.ts` (axios) para chamar a API — relevante so se mexer no front.

---

## 7. ARMADILHAS (cada uma ja custou tempo/token — evite)

- **`whatsapp.service.legacy.ts` (14.817 linhas) e CODIGO MORTO.** Nao e importado por nada em `src/` (so existe `.d.ts` no `dist/` antigo). NUNCA leia, edite ou use como referencia. O ativo e `whatsapp.service.ts` (1584L).
- **Arquivos `*.service.ts.disabled`** em `whatsapp/services/` (cart-integration, message-handler, order-flow, payment-flow) estao desativados de proposito. Ignore.
- **Edits no Edit tool falham silenciosamente as vezes** nesta sessao (param "missing"). Se acontecer, reenvie o mesmo Edit — nao reescreva o arquivo inteiro.
- **Multi-tenant (ver invariante 3.1):** query fora do contexto de tenant retorna vazio silenciosamente (nao da erro) — sintoma comum de "sumiu dado". E falta de contexto RLS, nao bug de dados.
- **Estoque** mora em `movimentacoes_estoque` (colunas `current_stock`, `reserved_stock`, `min_stock`), nao numa coluna em `produtos`.
- **Deploy:** build local NAO atualiza prod. Prod = Docker na VPS via SSH. Veja sec. 8.
- **Shell:** ambiente e Windows. Bash tool existe (POSIX), mas PowerShell e o shell primario. `Date.now()`/`Math.random()` nao existem em scripts de Workflow.

---

## 7.5. Padroes de codigo (siga o existente)

- **DTO + validacao:** input de endpoint sempre via DTO com `class-validator` (ex.: `auth/dto/login.dto.ts`). O `ValidationPipe` global (`main.ts:141`) faz whitelist + rejeita campo desconhecido. Validator custom = decorator em `common/decorators/`.
- **Erros:** use excecoes Nest (`BadRequestException`, `NotFoundException`, `ConflictException`), **nunca `throw new Error`**. O `common/filters/http-exception.filter.ts` mascara mensagem de >=500 em prod. Logar com objeto sanitizado (`this.logger.error(msg, { campoSeguro })`), nunca payload/telefone/token cru.
- **Contexto RLS em codigo (webhook/job fora do request):** o `TenantDbContextInterceptor` cobre requests normais. Fora dele, abra transacao e seta o tenant manualmente ANTES de qualquer query:
  ```ts
  await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
  ```
  Padrao replicado em `auth.service.ts:57`, `orders.service.ts:472`, `payments.service.ts:796`, `tenants.service.ts:74`. Sem isso, a query retorna vazio (nao da erro).

---

## 8. Comandos

```bash
# Backend (cd backend)
npm run start:dev | npm run build | npm run lint
npm run test:unit | npm run test:integration | npm run test:cov
npm run migration:show | migration:run | migration:generate -- src/database/migrations/Nome
npm run seed:mae        # seed dados de teste

# Frontend (cd frontend)
npm run dev | build | lint | type-check | test   # test = vitest

# VPS (ssh ubuntu@gtsofthub.com.br)
cd /opt/ucm && docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs -f backend
bash deploy/scripts/apply-and-health.sh   # deploy + health check
bash deploy/scripts/backup-postgres.sh
```

---

## 9. Webhooks (PUBLICOS, sem auth de usuario)

| Endpoint | Provider | Auth |
|---|---|---|
| `POST /api/v1/payments/webhook/mercadopago` | Mercado Pago | `x-signature` (HMAC) + `?token=` |
| `POST /api/v1/whatsapp/webhook` | Twilio / Evolution | assinatura do provider |

Ambos: `@Public()`, nginx `api_webhook` (5 r/s, burst 10), **idempotentes**, e DEVEM ser **fail-closed** se o secret faltar em prod.
Estado real (verificar antes de confiar): so o webhook MercadoPago tem `@Throttle({ webhook:{ttl:60000,limit:60} })`; o de WhatsApp (`whatsapp.controller.ts:351`) NAO tem o decorator (cai no throttle `default` 100/min em prod) **e hoje e fail-open** (`if (webhookSecret && signature)` — pendencia critica no backlog de seguranca).

---

## 10. Variaveis de ambiente criticas

| Var | Obrigatoria | Nota |
|---|---|---|
| `JWT_SECRET` / `ENCRYPTION_KEY` | sempre, min 32 | falha boot se faltar em prod |
| `DATABASE_URL` / `REDIS_URL` | sempre | inclui pwd; nao logar |
| `FRONTEND_URL` | prod | CORS allowlist |
| `SEED_DEV_USER` | nunca em prod | bloqueio no main.ts |
| `MERCADOPAGO_ACCESS_TOKEN` / `_WEBHOOK_TOKEN` | prod c/ pagamento | `TEST-*` em dev; webhook fail-closed sem token |
| `WHATSAPP_PROVIDER` / `_WEBHOOK_SECRET` | sempre / prod | `twilio`|`evolution`; webhook fail-closed sem secret |
| `PIX_KEY` | prod c/ PIX | falhar se mock em prod |

Exemplos: `deploy/env.prod.example`, `deploy/env.dev.example`.

---

## 11. Receitas de tarefa (caminho mais curto comprovado)

- **Mexer no bot WhatsApp:** comece em `whatsapp.service.ts` (orquestrador) -> siga para o servico especifico em `whatsapp/services/`. Logica de IA = `llm-router` + `action-executor` + `openai`. Nunca o `.legacy`.
- **Novo endpoint:** controller no modulo -> DTO com class-validator (padrao em sec. 7.5) -> service -> registrar no module. Publico? `@Public()` + rate limit. Toca PII? Audit log.
- **Mudanca de schema:** editar entity -> `migration:generate` -> revisar SQL gerado -> `migration:run` em dev -> testar. Nunca `synchronize`.
- **Bug de pagamento:** `payments.service.ts` + webhook handler. Verifique idempotencia e fail-closed antes de "corrigir".
- **Antes de PR/deploy:** rodar a **Definition of Done (sec. 0)** — ela ja cobre build, lint, type-check, secrets, webhook idempotente/fail-closed, migration e docs. Nao ha segundo checklist; este e o canonico.
