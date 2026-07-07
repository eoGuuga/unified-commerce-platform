# Plano de deploy — Frente de Segurança (Blocos 1 + 2), em bloco

**Data:** 2026-07-03
**Branch:** `security/bloco1-criticos` — **8 commits, NÃO mergeada, NÃO pushada.** Nada foi ao ar; as migrations só rodaram no banco de TESTE (`ucm_test_motor`), nunca em prod.
**Objetivo deste doc:** o mapa consolidado do que está acumulado, o plano de deploy e a validação pós-deploy. **NÃO é para executar ainda** — é para o dono decidir o deploy.

---

## 1. Inventário acumulado (precisa deploy pra valer? / já vale?)

| Item | O que é | Vale como? |
|---|---|---|
| **B1 #1 — rate-limit login efetivo** | código (`main.ts` + `http-hardening.ts`: `trust proxy`) | **precisa deploy do backend** |
| **B1 #2a — HSTS forte (helmet)** | código (backend) | **precisa deploy do backend** |
| **B1 #2b — headers nginx (HSTS/CSP/`server_tokens off`)** | config (`deploy/nginx/ucm.conf`) | **precisa deploy/reload do nginx** |
| **B1 #3a — boot fail-closed anti-superuser** | código (`main.ts` + `db-least-privilege.ts`) | **precisa deploy do backend** (aí passa a *garantir* o que já é verdade) |
| **B1 #3b — RLS já imposto em prod** | *estado do prod* (app já roda como `ucm_app`) | **JÁ VALE** hoje (verificado); o deploy só blinda |
| **B1 #3c — `.env.example`/`DATABASE_ADMIN_URL`/migrations** | config + `data-source.ts` | **precisa** o `DATABASE_ADMIN_URL` no `.env` de prod pra rodar as migrations |
| **B2 Fase A — RLS em 6 tabelas** | migration `1751900000000` (DDL) | **precisa rodar a migration em prod** (como admin). SEM código novo — o app já acessa essas tabelas no contexto |
| **B2 Fase B — RLS carrinho + sweepers refeitos** | migration `1752000000000` (DDL) **+ código** (CartService, StockSweeper, orders/payments) | **precisa migration + deploy do backend, JUNTOS** |

**Resumo:** quase tudo precisa de deploy (a branch não está em prod). O único item "já vale" é o fato de o prod já rodar como `ucm_app` (RLS já ativo para as tabelas que já tinham RLS). O deploy: **backend + nginx + 2 migrations**.

---

## 2. A sutileza crítica de ORDEM (Fase B)

`whatsapp_carts` sob RLS **exige** o código novo, e o código novo do sweeper **assume** o RLS. Coexistência quebra:
- **código velho + RLS novo:** o CartService velho (DataSource cru, sem contexto) → fluxo de carrinho do bot quebra (SELECT 0 / INSERT rejeitado).
- **código novo + RLS velho:** o sweeper novo varre por-tenant confiando no RLS pra escopar; **sem RLS**, o SELECT por-tenant volta TODOS os carrinhos → risco de liberar reserva no tenant errado.

**Portanto: nunca deixar os dois coexistirem.** A sequência segura elimina a janela **parando o backend durante a migration** (backend parado = sweeper não roda + nada servindo quebrado). Poucos segundos de downtime, em horário de baixo movimento — mais seguro que servir carrinho quebrado ou vazar reserva.

---

## 3. Sequência de deploy (recomendada)

Pré: `ssh ubuntu@gtsofthub.com.br`, prod em `/opt/gtsofthub`, `docker-compose.prod.yml`.

1. **Backup do banco** (obrigatório antes de migration):
   `bash deploy/scripts/backup-postgres.sh`
2. **Puxar a branch** para o prod (merge na main OU checkout da branch no servidor — decisão do dono; hoje prod == origin/main).
3. **Setar `DATABASE_ADMIN_URL` no `.env` de prod** = URL do **superuser** (o mesmo que a migration precisa pra DDL):
   `DATABASE_ADMIN_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/ucm`
   (o `data-source.ts` já prefere essa var; sem ela, `migration:run` roda como `ucm_app` e **falha** no DDL — é o ponto que quebra se esquecer.)
4. **Build limpo** (gotcha F16 — `deploy.sh` builda com cache; buildar `--no-cache`):
   `docker compose -p deploy -f deploy/docker-compose.prod.yml --env-file .env build --no-cache`
5. **Parar o backend** (fecha a janela de coexistência):
   `docker compose -p deploy -f deploy/docker-compose.prod.yml stop backend`
6. **Rodar as migrations como admin** (contêiner efêmero com o código NOVO + `DATABASE_ADMIN_URL`):
   `docker compose -p deploy -f deploy/docker-compose.prod.yml run --rm backend npm run migration:run`
   → aplica `1751900000000` (Fase A) e `1752000000000` (Fase B, incl. `app_list_tenant_ids()`), rastreadas em `typeorm_migrations`. Este contêiner **não** liga o `@Cron` (só roda a migration e sai).
7. **Subir tudo** (backend novo + frontend + nginx):
   `docker compose -p deploy -f deploy/docker-compose.prod.yml up -d`
   → o backend novo boota; **se bootar, o `assertDatabaseLeastPrivilege` passou** (app é restrito → RLS bite). Se conectasse como superuser, o boot abortaria (fail-closed).
8. **Recarregar o nginx** (se o container não recriou com a config nova):
   `docker compose -p deploy -f deploy/docker-compose.prod.yml exec nginx nginx -s reload` (ou recriar o container).
9. **Validar** (seção 4). Se algo falhar → **rollback** (seção 5).

---

## 4. Validação pós-deploy (o que confirmar — CRÍTICO)

### (a) O app continua vendendo
- `curl -sI https://gtsofthub.com.br/` → 200.
- Login do lojista funciona (JWT).
- **Fluxo de carrinho** (o maior risco da Fase B): fazer um round-trip real — adicionar item ao carrinho → checkout → pedido criado. Se o RLS+código estiverem OK, o pedido nasce; se o contexto quebrou, o carrinho dá erro. (Testar com o tenant da doceria.)

### (b) Os DOIS sweepers rodando e limpando (o job que quebra silencioso)
O sweeper loga em `debug` (`Sweeper: N ... em M tenant(s)`), que pode não aparecer em prod. **Prova funcional positiva** (não confiar só em log):
- **Cart sweeper:** inserir (como postgres) um carrinho de teste do tenant real com `expires_at` no passado e `stock_released_at NULL`; esperar ~70s (1 tick); consultar → `stock_released_at` deve estar preenchido e `status='expired'`. Se ficou, o sweeper rodou E limpou.
- **Pending-order sweeper** (o bug recém-consertado): criar (ou já ter) um pedido `pendente_pagamento` com `created_at` além do TTL e `stock_released_at NULL`; após 1 tick → deve virar `cancelado` com `stock_released_at` preenchido. Isso prova que o sweep de pedidos — que era no-op silencioso — voltou a funcionar.
- Confirmar cross-tenant: rodar o teste com **2 tenants** e ver que ambos foram limpos (é o que a prova automatizada `rls-fase-b` já garante; em prod, se houver >1 lojista, checar os dois).
- Nos logs: `docker compose ... logs --since=3m backend | grep -i sweeper` (se `debug` estiver ligado) mostra "em M tenant(s)".

### (c) RLS imposto em prod (query de verificação)
- **Prova implícita:** o backend **bootou** → `assertDatabaseLeastPrivilege` passou → app é `NOSUPERUSER`/sem `BYPASSRLS` → RLS é imposto.
- **Estrutural** (como postgres, sem PII): confirmar que as tabelas do Bloco 2 têm FORCE RLS + policy:
  ```sql
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class WHERE relname IN
   ('whatsapp_carts','whatsapp_message_metrics','whatsapp_conversation_metrics',
    'whatsapp_conversion_events','whatsapp_abandonment_events',
    'movimentacoes_estoque_historico','reservas_estoque')
  ORDER BY relname;   -- todos devem ter t | t
  ```
- **Funcional** (opcional, precisa a senha do `ucm_app`): como `ucm_app`, `SELECT count(*) FROM whatsapp_carts` **sem** contexto → deve dar **0** (RLS bloqueia), enquanto como postgres mostra a contagem real.

### (d) Rate-limit + headers ativos
- **Headers:** `curl -sI https://gtsofthub.com.br/` → deve ter `strict-transport-security`, `content-security-policy`, `x-frame-options`, `x-content-type-options`, e `server: nginx` **sem versão** (`server_tokens off`).
- **Rate-limit:** 11 POSTs rápidos a `/api/v1/auth/login` do mesmo IP → o 11º deve voltar **429** (o nginx também limita `/auth` a 1 r/s, então pode vir 429 antes — ambos são proteção). Confirma que o `trust proxy` faz o balde ser por-cliente.

---

## 5. Rollback
- **Código:** re-deploy da imagem anterior (`git checkout <commit-anterior>` + build + up -d).
- **Migrations:** cada uma tem `down()` reversível. `docker compose ... run --rm backend npm run migration:revert` (com `DATABASE_ADMIN_URL`) reverte a última. As duas migrations só ligam RLS/criam a função — o `down` desliga RLS e dropa a função, voltando ao estado atual (sem RLS nessas tabelas). **Reverter o RLS sem reverter o código** deixa código-novo + RLS-velho (aceitável: o código seta contexto que vira no-op sem RLS — mas o sweeper por-tenant precisaria do RLS; se reverter, reverter código junto).
- **Backup:** restaurar do backup do passo 1 se necessário (pior caso).

---

## 6. `email_confirmations` (Fase C) — deixar sem RLS NÃO é buraco crítico

Confirmado e registrado: **não é uma pendência de segurança crítica.**
- A tabela **não tem `tenant_id`** e o fluxo (send/confirm) é **`@Public`, pré-login**, sem contexto de tenant. RLS por tenant **não se aplica** sem reescrever o fluxo.
- **Por que não é um buraco crítico:** os registros são **códigos efêmeros de 6 dígitos**, ligados a um `user_id`, **uso único**, **TTL de 15 min**, e o endpoint é **rate-limited**. As buscas são sempre por `user_id`+`code` (não enumeráveis cross-tenant pela API), e os endpoints retornam só sucesso/erro — **não expõem dados cross-tenant**. Não há vetor de vazamento pela aplicação.
- **O controle certo é app-level + TTL**, não RLS: manter os controles atuais + adicionar um **job de limpeza** que apaga linhas expiradas/usadas (o índice em `expires_at` já existe). Isso encaixa na realidade pré-login.
- **Alternativa pesada (se algum dia quiser paridade de RLS):** policy por EXISTS-join em `usuarios` **e** reescrever `sendConfirmationEmail`/`confirmEmailCode` pra estabelecer contexto de tenant. Custo alto, ganho marginal.
- **Decisão:** dono decide depois; **deixar como está não bloqueia o deploy da frente de segurança.**

---

## 7. Estado da suíte (para referência)
- Novos testes de segurança: todos verdes (rate-limit, headers, boot-assert, RLS Fase A 11/11, RLS Fase B 4/4, RLS enforcement 7/7, cart integration 5/5).
- `test:unit`: **39 falhas pré-existentes** (copy WhatsApp/products) — inalteradas, não são regressão.
- `orders/payments.integration`: falham em **dados de teste deixados de runs anteriores** (SKU duplicado em `produtos`, no *seed*) — flakiness pré-existente de isolamento de teste, fora do escopo. Vale limpar o banco de teste um dia.
