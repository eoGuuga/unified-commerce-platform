# 🔐 Frente de Segurança — ponto de retomada (sessão de deploy dedicada)

**Data:** 2026-07-03
**Status:** frente de RLS + hardening **PRONTA e provada por teste**, acumulada na branch **`security/bloco1-criticos`** (9 commits) — **NÃO mergeada, NÃO pushada, NADA em prod.**
**Decisão do dono:** o deploy (migration em prod + validação de jobs de fundo que quebram silenciosos) é delicado demais pra fazer no fim de uma sessão longa. Aguarda uma **sessão dedicada, com o dono descansado** — coerente com o princípio da própria frente: *nada delicado com pressa.*

**Este doc é o ponto de entrada da retomada.** Detalhe em: `2026-07-03-security-deploy-plan.md` (plano+validação), `2026-07-02-security-bloco1.md`, `2026-07-03-security-bloco2.md`.

---

## Estado confirmado (2026-07-03)
- **Nada foi ao ar.** Prod responde HTTP 200 com o estado ANTIGO (`Server: nginx/1.27.5` com versão, sem HSTS/CSP) → o produto **segue funcionando** e as mudanças de segurança **não estão live**.
- **Espelho do GitHub intacto:** `main` local == `origin/main` (0/0). Os 9 commits de segurança estão **só na branch local**, nenhum na main/espelho.
- As migrations **só rodaram no banco de TESTE** (`ucm_test_motor`), **nunca em prod**.

---

## O que está acumulado na branch (tudo provado por teste)

**Bloco 1 — 3 críticos:**
- `81e35ac` — rate-limit de login efetivo (`trust proxy`; o throttle estava cego atrás do nginx). Prova: N+1→429 + por-cliente-real.
- `c751746` — HSTS forte + CSP + `server_tokens off` (helmet + nginx). CORS confirmado restrito.
- `ba1acb6` — privilégio mínimo no banco: boot **fail-closed** anti-superuser + prova de que o RLS é imposto pelo banco (integração sob papel restrito 7/7). Prod já roda como `ucm_app`.

**Bloco 2 — RLS em todas as tabelas sensíveis:**
- `5f2c6a9` — Fase A: RLS+FORCE+policy em 6 tabelas (4 métricas WhatsApp + `movimentacoes_estoque_historico` + `reservas_estoque`). Migration `1751900000000`. Prova `rls-fase-a.integration` 11/11.
- `32f84d0` — Fase B: RLS+FORCE em `whatsapp_carts` + os **DOIS sweepers refeitos** (loop-por-tenant) + `app_list_tenant_ids()` (SECURITY DEFINER, enumera tenants sem o app ter BYPASSRLS). Migration `1752000000000`. **Consertou de brinde o 2º sweeper (pedidos), que já era no-op silencioso em prod.** Prova `rls-fase-b.integration` 4/4 (RLS protege + os 2 sweepers limpam todos os tenants sob papel restrito).
- Docs: `ed18493`, `74bd0d4`, `6aca005`, `9254dfd`.

**Suíte:** todos os testes de segurança verdes. `test:unit` = 39 falhas **pré-existentes** (copy WhatsApp/products), inalteradas. `orders/payments.integration` falham só em **dado de teste leftover** (SKU duplicado em `produtos`, no seed) — flakiness pré-existente, não regressão.

---

## Plano de deploy (resumo — completo em `2026-07-03-security-deploy-plan.md`)

**Migrations a rodar (COMO ADMIN, não `ucm_app`):** `1751900000000` (Fase A) + `1752000000000` (Fase B). O `ucm_app` **não faz DDL** → setar `DATABASE_ADMIN_URL=postgresql://postgres:<pwd>@postgres:5432/ucm` no `.env` de prod (o `data-source.ts` já prefere essa var). **Esquecer isso = migration falha no DDL.**

**Sequência segura:** backup → `DATABASE_ADMIN_URL` no `.env` → **build `--no-cache`** (gotcha F16) → **`stop backend`** → `run --rm backend npm run migration:run` (contêiner efêmero, código novo, não liga o `@Cron`) → **`up -d`** → reload nginx. O **stop-backend** fecha a janela crítica onde código-velho+RLS-novo (quebra carrinho) ou código-novo+RLS-velho (sweeper vaza reserva) coexistiriam.

**Validação pós-deploy (o crítico):**
- **(a) app vendendo:** `curl -I` 200 + login + **round-trip de carrinho** (add→checkout→pedido) no tenant da doceria.
- **(b) os DOIS sweepers rodando+limpando** (job que quebra silencioso — prova FUNCIONAL, não log): inserir carrinho de teste `expires_at` no passado → após ~70s → `stock_released_at` preenchido; criar pedido `pendente_pagamento` além do TTL → após 1 tick → `cancelado`. Com >1 lojista, checar ambos.
- **(c) RLS imposto:** o backend **bootar** já prova (o `assertDatabaseLeastPrivilege` aborta se for superuser) + query estrutural (postgres) `relforcerowsecurity=true` nas 7 tabelas do Bloco 2 + opcional: como `ucm_app`, `SELECT count(*) FROM whatsapp_carts` sem contexto → **0**.
- **(d) rate-limit + headers:** `curl -I` mostra HSTS/CSP/X-Frame/`server` sem versão; 11 POSTs a `/auth/login` → 11º = **429**.

**Rollback:** `down()` reversível nas 2 migrations (revert com `DATABASE_ADMIN_URL`) + re-deploy da imagem anterior + backup do passo 1.

---

## O que fica pra depois

### Fase C — `email_confirmations` (sem RLS) — decisão do dono, NÃO é buraco crítico
Não tem `tenant_id`, fluxo `@Public`/pré-login sem contexto → RLS não se aplica sem reescrever o fluxo. **Não bloqueia nada:** códigos efêmeros 6 dígitos, uso único, TTL 15 min, rate-limited, lookup por `user_id`+`code` (não enumerável), endpoints não expõem dado cross-tenant. Controle certo = **app-level + job de limpeza TTL**. Dono decide depois.

### Bloco 3 — achados Tier-2/altos da auditoria (ainda NÃO atacados)
A auditoria adversarial (7 dimensões) achou mais que os 3 críticos. Backlog para um bloco próprio, por urgência:

**🔴 HIGH e JÁ VIVO (independe de deploy — são buracos ativos agora):**
- **SSH frouxo:** `PasswordAuthentication yes` + `PermitRootLogin yes` no prod → força-brutável. Endurecer: **key-only + sem root + fail2ban**. (Config de servidor.)
- **Dependências com CVE de runtime:** `axios`/`next`/`ws`/`multer`/`path-to-regexp` (DoS por ReDoS/multipart, bypass de auth no `next`, prototype-pollution no `axios`). `npm audit fix` + redeploy.

**🟠 HIGH (design/latente):**
- **`ENCRYPTION_KEY` única global** — vazamento descriptografa credenciais de todos os lojistas; sem rotação. Envelope encryption. **Vira crítico na frente de recebimento por-lojista** (ver `recebimento-por-lojista-investigado`).
- **Logout sem revogação server-side + JWT no `localStorage`** — token roubado vale até expirar, "deslogar de todos" impossível. `token_version`/`password_changed_at` no JWT + cookie httpOnly.

**🟡 MEDIUM:**
- Sem `JwtAuthGuard` global (endpoint novo que esquecer o guard nasce público).
- `PATCH /tenants/branding` sem role guard (SELLER faz defacement — Risco B insider).
- `role` controlado pelo cliente no register (privesc latente).
- `StructuredLogger` sem redação + **PII (telefone/email) em log** (LGPD).
- CSRF off-por-padrão / não bound à sessão; Throttler in-memory (fura se escalar réplicas); sem `${VAR:?}` nos secrets do compose.

**⚪ LOW:** compare de token MP não-constante + `validateWebhookSignature` fail-open com secret vazio; LGPD com histórico em memória; política de senha fraca (min 6) + bcrypt cost 10; código de confirmação com `Math.random()`; `cupons_desconto.code` unique global entre tenants.

---

## Como retomar (sessão dedicada, dono descansado)
1. `git checkout security/bloco1-criticos` (a branch é local; 9 commits).
2. Ler este doc + `2026-07-03-security-deploy-plan.md`.
3. Executar a sequência de deploy (com backup) e rodar a validação pós-deploy **passo a passo** — especialmente a prova FUNCIONAL dos 2 sweepers e o round-trip de carrinho.
4. Só então mergear na main + push (o espelho do GitHub passa a ter a frente).
5. Depois: decidir Fase C e planejar o Bloco 3 (começar pelos HIGH vivos: SSH + `npm audit`).
