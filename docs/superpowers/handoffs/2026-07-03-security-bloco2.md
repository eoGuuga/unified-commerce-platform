# Handoff — Frente de Segurança, Bloco 2 (achado F2: tabelas sem RLS)

**Data:** 2026-07-03
**Branch:** `security/bloco1-criticos` (acumula a frente de segurança — **NÃO mergeado, NÃO pushado**)
**Origem:** achado F2 da auditoria adversarial — tabelas com `tenant_id` mas **sem RLS**, onde a defesa-em-profundidade provada no Bloco 1 (#3) ainda não se aplica. Levantamento read-only feito antes de consertar (3 exploradores) para achar as sutilezas.

## Fase A — 6 tabelas "verdes" — ✅ FEITO (commit `5f2c6a9`)
Migration `1751900000000-EnableRlsOnRemainingTables.ts` liga `ENABLE+FORCE+<tabela>_tenant_isolation` (padrão do projeto, GUC `current_setting('app.current_tenant_id', true)::uuid`) em:
`whatsapp_message_metrics`, `whatsapp_conversation_metrics`, `whatsapp_conversion_events`, `whatsapp_abandonment_events`, `movimentacoes_estoque_historico`, `reservas_estoque`.
- **Seguras porque:** acesso sempre no escopo do tenant (as 4 métricas via contexto ALS; o ledger tem writers/reader que já setam contexto; `reservas_estoque` é tabela morta). **Nenhum job de fundo as varre cross-tenant** (o sweeper toca `whatsapp_carts` e `pedidos`, não estas).
- **Prova** (`rls-fase-a.integration.spec.ts`, 11/11): estrutural (as 6 têm ENABLE+FORCE+policy) + comportamental sob o papel restrito (sem contexto → 0; com tenant → só o dele) para as 5 sem-FK; `reservas_estoque` (FK + morta) na prova estrutural.
- **Deploy:** a migration precisa rodar em prod com o `DATABASE_ADMIN_URL` (papel privilegiado; o `ucm_app` restrito não faz DDL) — passo do deploy-em-bloco, com aprovação.

---

## Fase B — `whatsapp_carts` + o sweeper — ✅ FEITO (commit `32f84d0`)

**Abordagem (a) loop-por-tenant, app 100% restrito (sem BYPASSRLS).** Migration `1752000000000`: RLS+FORCE+policy em `whatsapp_carts` + a primitiva **`app_list_tenant_ids()` (SECURITY DEFINER)** que resolve a enumeração — o job lista os tenants sem o papel do app ter BYPASSRLS (retorna só UUIDs; app segue NOSUPERUSER). `CartService` roteado pelo contexto por-tenant (`withCart`; `releaseExpiredCart(cartId, tenantId)`). `StockSweeper` itera por-tenant (enumera → set_config → varre). `releaseExpiredPendingOrder(orderId, tenantId)` seta contexto antes do UPDATE — **conserta de brinde o no-op silencioso do sweep de pedidos**. Único `@Cron` do backend (confirmado); nenhum outro job cross-tenant.

**Provas (`rls-fase-b.integration.spec`, 4/4, sob o papel restrito):** (1a) `whatsapp_carts` tem ENABLE+FORCE+policy; (1b) sem contexto → 0, com tenant → só o dele; enumeração via `app_list_tenant_ids()` lista os tenants; (2) o **sweeper REAL** limpou os expirados de 2 tenants enquanto a varredura ingênua (sem contexto) via 0, e o carrinho futuro ficou intacto.

**Deploy:** a migration precisa rodar em prod com `DATABASE_ADMIN_URL` + deploy do código junto (senão o fluxo de carrinho quebra) — deploy-em-bloco, com aprovação.

---

### Registro do desenho original da Fase B (por que não era "liga direto")

Só quebrava em PROD (dev/testes conectam como superuser e furam o RLS → dariam falso-verde). Dois problemas:
1. O `CartService` lê/grava `whatsapp_carts` via **DataSource cru** (sem contexto de tenant) — `cart.service.ts:56-58`. Com RLS: SELECT/UPDATE → 0, INSERT rejeitado pelo `WITH CHECK` → **o fluxo de carrinho do bot lança erro**.
2. O `@Cron` **`StockSweeperService`** (`stock-sweeper.service.ts:28`) faz `SELECT id FROM whatsapp_carts` **cross-tenant, sem contexto** (`:50-56`). Com RLS → 0 linhas → **carrinhos expirados nunca liberados → vazamento de reserva de estoque**.

**Bug pré-existente ligado (independe de F2):** o outro sweep, `sweepExpiredPendingOrders` (`:85-92`), faz `SELECT id FROM pedidos` sem contexto — e `pedidos` **já é FORCE-RLS** → sob o `ucm_app` **já retorna 0 hoje** → provavelmente **já é no-op silencioso em prod**. Os comentários do sweeper (`:41-49`, `:79-84`) apostam no contrário porque assumem "app = superuser" (premissa que o #3 derrubou).

**A pergunta-chave de design (o "sweeper roda como quê?"):** um job cross-tenant precisa **enumerar** os itens de trabalho (carrinhos/pedidos expirados de todos os tenants), mas as tabelas-fonte ficam FORCE-RLS → uma leitura sem contexto retorna 0. Opções:
- **(a) Loop por-tenant (app 100% restrito):** enumerar os tenants e, para cada um, `set_config('app.current_tenant_id', tid, ...)` antes do SELECT — igual aos caminhos de release que já fazem isso (`cart.service.ts:306`, `orders.service.ts:900`). **Sutileza:** para *listar* os tenants, `tenants` também é FORCE-RLS → precisa de uma fonte de enumeração que não dependa de leitura cross-tenant (ex.: uma query dedicada, ou o passo de enumeração num papel BYPASSRLS estreito). Mantém o papel do app sem privilégio.
- **(b) Papel BYPASSRLS só para o sweeper:** o sweeper conecta com um papel separado com BYPASSRLS (SELECT-only nas tabelas do sweep), mantendo o papel principal do app restrito. Enumera cross-tenant em 1 query. **Custo:** existe um papel BYPASSRLS (superfície de ataque se vazar) + 2ª conexão/config; precisa ser estreitíssimo.
- **(c) Policy que permite o sweeper:** ramo de policy por papel — bagunçado, não recomendado.
- **Recomendação preliminar:** (a) por padrão (preserva least-privilege), resolvendo a enumeração com um caminho estreito; (b) é aceitável se a enumeração ficar simples demais no (a). **Decidir no início da Fase B.**

**Plano da Fase B (quando abrir):** (1) rotear TODO acesso a `whatsapp_carts` (CartService CRUD + `getAnalytics` + `releaseExpiredCart`) pelo contexto de tenant; (2) consertar o sweeper (enumeração + per-tenant `set_config`) — resolve o bug do `pedidos` de brinde; (3) só então ligar `ENABLE+FORCE+tenant_isolation` em `whatsapp_carts`; (4) **prova sob o papel restrito** (o normal daria falso-verde): o fluxo de carrinho funciona COM contexto, o sweeper libera expirados de vários tenants, e o isolamento cross-tenant se mantém.

---

## Fase C — `email_confirmations` — ⏳ NÃO FEITO (decisão + frente própria)

**Sutileza:** a tabela **não tem `tenant_id`** e o fluxo send/confirm é `@Public`/pré-login, sem contexto de tenant, via repositório cru (`auth.service.ts:216-296`). RLS não aplica direto — nem a variante por EXISTS-join, sem reescrever o fluxo (o INSERT seria rejeitado e o SELECT → 0).

**Opções:**
- **(recomendado) Controles de app + limpeza TTL:** manter o que já protege (lookup por `user_id`+`code`, uso único, TTL 15min, rate-limit) e **adicionar um job agendado de limpeza** por `expires_at` (o índice já existe). Encaixa na realidade pré-login; sem reescrever fluxo.
- **(pesado) RLS via join + reescrever fluxo:** policy por EXISTS-join em `usuarios` **e** reescrever `sendConfirmationEmail`/`confirmEmailCode` para resolver o `tenant_id` do usuário e rodar dentro de `runWithTenantContext`.

**Estado:** dono deixou a escolha para uma frente própria ("decido depois"). Só registrar; não implementar.

---

## Como rerodar as provas de RLS
Túnel SSH + banco `ucm_test_motor` (ver memória `test-db-setup-motor`), migration aplicada, depois:
`cd backend && npx jest rls-fase-a.integration rls-enforcement.integration`

## Nota sobre a suíte de integração
`orders.integration.spec.ts` tem 2 testes que falham por **dados de teste deixados de runs anteriores** (SKU duplicado `produto-teste-e2e-orders-*` em `produtos`, tabela fora do escopo da Fase A) — flakiness pré-existente de isolamento de teste, **não** regressão. Todos os testes que escrevem o ledger (`movimentacoes_estoque_historico`) passam.
