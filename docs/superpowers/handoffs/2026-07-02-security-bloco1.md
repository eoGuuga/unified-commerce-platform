# Handoff — Frente de Segurança, Bloco 1 (3 críticos)

**Data:** 2026-07-02
**Branch:** `security/bloco1-criticos` (3 commits — **NÃO mergeado, NÃO pushado**)
**Origem:** auditoria de segurança adversarial (read-only, 7 dimensões) feita nesta sessão. Bloco 1 ataca os 3 achados de maior dano × explorabilidade. Cada conserto tem **teste que prova o ataque bloqueado** (não afirmação).

## Decisão de deploy (importante)
**Não mergear ainda.** A frente de segurança **acumula** e será deployada **em bloco, com cuidado, depois de revisar** — porque parte do Bloco 1 só passa a valer com deploy:
- os **headers do nginx** (`deploy/nginx/ucm.conf`) só aplicam após reload/deploy do nginx;
- o **rate-limit efetivo em prod** (`trust proxy`) só vale no próximo deploy do backend.

A branch está guardada localmente. Nada foi ao ar.

## Os 3 consertos

### #1 — Rate limit de login efetivo (`81e35ac`)
- **Buraco:** o `@Throttle` do `/auth/login` já existia, mas sem `trust proxy` o `@nestjs/throttler` chaveava no IP do nginx → todos os clientes num balde só (atacante não isolado + dá pra negar login a todos).
- **Fix:** `applyExpressHardening()` (`backend/src/common/security/http-hardening.ts`) liga `trust proxy` (1 hop = nginx); `main.ts` usa.
- **Prova:** `auth-rate-limit.security.spec.ts` — N+1 do mesmo cliente → 429; e contagem **por cliente real** (X-Forwarded-For), um atacante esgotado não nega login a outro. O teste **falha sem o fix**.

### #2 — Headers de segurança + hardening web (`c751746`)
- **Buraco:** a raiz do site (frontend, servido pelo nginx) vinha **sem HSTS e sem CSP** (confirmado por `curl` no prod); nginx vazava a versão.
- **Fix:** helmet com HSTS explícito de 2 anos (`buildHelmetOptions()`); nginx com HSTS + CSP conservador (`frame-ancestors/base-uri/object-src` — não quebra o Next.js) + `server_tokens off`.
- **CORS:** confirmado já-restrito (allowlist fail-closed, sem `*`) — sem mudança.
- **Prova:** `security-headers.security.spec.ts` — HSTS/X-Frame-Options/X-Content-Type-Options presentes, X-Powered-By ausente.

### #3 — Privilégio mínimo no banco + RLS imposto (`ba1acb6`) — o mais importante
- **Verificação (read-only no prod):** o prod **já conecta como `ucm_app`** (`rolsuper=f`, `rolbypassrls=f`, não-dono das tabelas) → **o RLS já é imposto de verdade em prod**. A auditoria disse "superuser" porque leu o `backend/.env` de **teste** (aponta pro `ucm_test_motor`).
- **Blindagem:** boot **fail-closed** — `assertDatabaseLeastPrivilege()` (`backend/src/common/security/db-least-privilege.ts`), chamada em `main.ts`: **em produção o app recusa subir se conectar como superuser ou BYPASSRLS**. Defesa-em-profundidade permanente.
- **Prova (a peça central):** `rls-enforcement.integration.spec.ts` conecta por um papel restrito (mesmos grants do `deploy/scripts/provision-db-user.sh`) e prova: (a) o papel restrito faz SELECT/INSERT/sequences/set_config (nenhum grant faltando); (b) **sem contexto de tenant → 0 linhas** numa tabela FORCE-RLS (havendo dados); (c) com tenant A → só A; com B → só B; contraste: o superuser vê tudo sem contexto. **7/7 verdes.**
- **Higiene:** `backend/.env.example` passa a usar `ucm_app` no runtime + `DATABASE_ADMIN_URL` separado só pras migrations (`data-source.ts` prefere o admin URL — DDL precisa de papel privilegiado; runtime não pode ter).

## `backend/.env` — confirmado NÃO-incidente
`git log --all` vazio pra qualquer `.env`; não-rastreado; gitignored. **Nunca foi commitado nem pushado.** A senha ali é a do **banco de TESTE** local. Não precisa rotação-por-vazamento.

## Estado da suíte
17 testes novos verdes (10 unit + 7 integração). As **39 falhas** da suíte unit são **pré-existentes** (copy de WhatsApp/products) — confirmadas na `main`, **não são regressão** do Bloco 1. Build + lint limpos.

## Próximo: Bloco 2 = achado F2
**8 tabelas sem RLS** + `reservas_estoque` (ENABLE-sem-FORCE), verificadas no prod: `whatsapp_carts`, `whatsapp_message_metrics`, `whatsapp_conversation_metrics`, `whatsapp_conversion_events`, `whatsapp_abandonment_events`, `email_confirmations`, `movimentacoes_estoque_historico`, `reservas_estoque`. É onde a defesa-em-profundidade provada no #3 **ainda não se aplica**.
**Sutileza a mapear ANTES de consertar:** ligar FORCE numa tabela varrida por **job cross-tenant (sweeper)** quebra o job silenciosamente; `email_confirmations` pode não ter `tenant_id`. Levantamento read-only em andamento.

## Rerodar os testes de segurança
- Unit: `cd backend && npx jest security-headers.security auth-rate-limit.security db-least-privilege.spec`
- Integração de RLS (precisa do banco de teste): túnel SSH + `ucm_test_motor` (ver memória `test-db-setup-motor`), depois `npx jest rls-enforcement.integration`.
