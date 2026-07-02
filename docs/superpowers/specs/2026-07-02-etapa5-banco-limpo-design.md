# Etapa 5 — Banco limpo (zerar + migrations do zero + seed da doceria) — Design

**Data:** 2026-07-02
**Tipo:** Infra (execução no servidor via SSH) — o ÚNICO passo da faxina **sem rollback** (banco compartilhado).
**Status:** Proposta — aguardando aprovação. NÃO executar até o "ok".
**Contexto:** Etapa 4 (swap) concluída — prod roda de `/opt/gtsofthub` (código = `origin/main`). Diagnóstico confirmou **schema drift** como causa do 500 da Camada 2. Receita de migration **provada** em banco de teste (2026-07-02).

---

## 1. Objetivo
Recriar o banco `ucm` **limpo e reprodutível**: schema 100% via migrations (não mais SQL rodado à mão sem tracking), + seed da doceria "Loucas por Brigadeiro" como lojista de exemplo com **UUID real**. Isso:
- Resolve o **500 da Camada 2** (cria `store_availability_exceptions` + demais tabelas recentes que faltavam).
- Prova reprodutibilidade (migrations do zero, `typeorm_migrations` populada).
- Amarra o **fix do login** (Causa 2): o UUID real da doceria vira o `NEXT_PUBLIC_TENANT_ID` do frontend (Etapa 5b).

## 2. Decisões travadas (dono)
- **D1 — UUID real da doceria:** `2675a300-1f03-4c74-b462-99754fd70eb2` (v4 gerado; **não** `000…000`, que é o sentinel que quebra o login). Usado no seed **e** no `NEXT_PUBLIC_TENANT_ID` do build do front.
- **D2 — Doceria = lojista de exemplo do seed:** "Loucas por Brigadeiro" (catálogo real, primeiro cliente real, melhor demo).
- **D3 — Único ambiente** (dev = prod), já vigente.
- **D4 (a confirmar) — credenciais do admin:** proposta `admin@loja.com` / senha a definir pelo dono (o seed atual usa `senha123` — trocar por uma senha forte que o dono controle). *Decisão do dono no plano.*

## 3. Princípio ordenador
**Este é o único passo irreversível** (não há "up do velho" — o banco é compartilhado e será zerado). Por isso:
- **Provar a sequência COMPLETA (migrate + grants + seed) num banco de teste descartável ANTES** de tocar o `ucm` — estende a prova já feita das migrations pra incluir grants + seed.
- **Reconfirmar dummy na hora** (verifica-não-confia): `count` de pedidos pagos/entregues = 0 imediatamente antes de dropar; se ≠ 0, PARA.
- Cada passo destrutivo confirmado; sem improviso.

## 4. Receita de migration — PROVADA (2026-07-02, banco de teste)
`migration:run` do zero rodou limpo: **11/11 migrations**, 23 tabelas (incl. `store_availability_exceptions`), RLS enabled+forced, `ucm_app` lê sob RLS sem permission denied. Mecânica validada:
- Migrar como admin via container one-off `deploy-backend:latest`, `--network container:ucm-postgres`, `DATABASE_URL=postgresql://postgres@127.0.0.1:5432/<db>` (127.0.0.1 = `trust` no pg_hba, contorna a senha TCP do superuser — ver F9), `-v /opt/gtsofthub/scripts:/app/scripts:ro` (baseline lê os SQLs — ver F8), `node_modules/.bin/typeorm -d dist/database/data-source.js migration:run`.
- Grants do `ucm_app` restaurados via `deploy/scripts/provision-db-user.sh` (GRANTs + ALTER DEFAULT PRIVILEGES).

## 5. Seed — precisa consolidação + prova (NÃO é one-liner limpo)
Estado atual dos seeds (bagunçado — o plano corrige):
- `scripts/seeds/seed-produtos-mae.ts`: `TENANT_ID='000…000'` **hardcoded**, cria tenant "Loucas por Brigadeiro" + catálogo + estoque. **Não** cria usuário. **Não** seta contexto RLS.
- `scripts/seeds/seed-usuario-padrao.ts`: `TENANT_ID='000…000'` **hardcoded**, cria tenant "Loja Chocola Velha" (**identidade divergente!**) + admin `admin@loja.com`/`senha123`. **Não** seta contexto RLS.
- Ambos rodam via `ts-node` contra o **source** (`backend/src` + `scripts/seeds`), que **não está na imagem de prod** (só `dist/`).

**Correções no seed (tasks do plano):**
- **Parametrizar o UUID:** ambos leem `SEED_TENANT_ID` do env (fallback ao constante), pra receber `2675a300-…` sem editar código toda vez.
- **Identidade única:** rodar `seed-produtos-mae` **primeiro** (cria o tenant "Loucas por Brigadeiro"); `seed-usuario-padrao` roda depois e **encontra** o tenant existente (não cria "Loja Chocola Velha"). Alinhar o nome/domínio no usuario-seed pra não divergir se rodar isolado.
- **RLS:** rodar os seeds como **superuser** (`postgres@127.0.0.1`, bypassa RLS) — mesma mecânica das migrations. Sem isso, os INSERTs quebram no schema com RLS forced.
- **Rodar contra o source:** o container de seed precisa do `backend/src` + `node_modules` + `scripts/seeds`. Mecânica exata **definida e provada** no test DB (task de prova), antes do `ucm`.

**🔒 Backdoor default (removido no T2):** as migrations (`001-initial-schema.sql:374-382`) semeiam um tenant "Loja de Exemplo" (`000…000`) + admin `admin@exemplo.com` com `crypt('admin123', gen_salt('bf'))` — **provado na T1**. Num servidor público é credencial conhecida (backdoor). O **T2.5b** remove ambos após o seed (DELETE como `postgres`), deixando o banco só com a doceria (`2675a300-…`) + `admin@loja.com`. A remoção dessa criação no **código** da migration é o follow-up F12.

## 6. Login (Causa 2) — Etapa 5b (logo após o seed, mesma sessão)
Com o UUID real definido, o fix do login é config de frontend:
- **`NEXT_PUBLIC_TENANT_ID = 2675a300-…`** no build do frontend (via `deploy/.env` / build arg do compose).
- **Resolver a colisão sentinela×UUID-real** em `frontend/app/login/LoginExperience.tsx` + `lib/config.ts`: com um tenant configurado, o campo "workspace" deve ficar **escondido** e o header `x-tenant-id` enviado automaticamente (hoje a lógica esconde quando é sentinel e mostra o UUID cru — invertido pro caso single-tenant).
- Rebuild do frontend + recria só o container do front → validar login **no ar** (admin logando, `/admin/configuracoes` + "Próximas exceções" 200) em prod e dev.

## 7. Riscos & mitigações
- **R-A — Irreversível:** único passo sem rollback. Mitigação: prova completa em test DB + reconfirmar dummy na hora + cada passo confirmado.
- **R-B — Seed não-provado:** mitigação: task de prova (migrate+grants+seed no test DB) é **gate** antes do `ucm`.
- **R-C — F9 (senha postgres TCP):** contornado via netns+127.0.0.1 trust (provado). Fix definitivo é follow-up.
- **R-D — F8 (scripts fora da imagem):** contornado via mount (provado). Fix definitivo (Dockerfile) é follow-up (Etapa 7/deploy.sh).
- **R-E — F10 (webhook_events/usage_logs sem migration):** pré-existente, fora do escopo desta etapa; anotado.

## 8. Escopo / Não-escopo
- **Escopo:** zerar+recriar `ucm`, migrations do zero, grants do `ucm_app`, seed consolidado da doceria (UUID real), Etapa 5b (login no ar), prova prévia em test DB.
- **Não-escopo:** Dockerfile embutir scripts (F8, Etapa 7), fix da senha postgres TCP (F9), migrations de `webhook_events`/`usage_logs` (F10), `deploy.sh` (Etapa 7), remoção do `/opt/ucm` velho (Etapa 6).
