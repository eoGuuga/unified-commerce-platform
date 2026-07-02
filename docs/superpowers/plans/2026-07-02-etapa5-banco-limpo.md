# Etapa 5 — Banco limpo — Plano (runbook)

> **Execução:** infra via SSH `ubuntu@gtsofthub.com.br`. Cada 🔴 confirmado na hora. **T2 é irreversível** — só roda após T0+T1 verdes E o "ok" do dono.

**Goal:** recriar `ucm` limpo (migrations do zero) + seed da doceria com UUID real, resolver o 500 da Camada 2 e amarrar o fix do login.

**Constantes:**
- `UUID_DOCERIA = 2675a300-1f03-4c74-b462-99754fd70eb2`
- Imagem: `deploy-backend:latest` · rede: `--network container:ucm-postgres` · admin: `postgresql://postgres@127.0.0.1:5432/<db>` (trust) · scripts: `-v /opt/gtsofthub/scripts:/app/scripts:ro`
- Admin do seed: `admin@loja.com` / **<SENHA_ADMIN a definir pelo dono>** (D4).

---

## T0 — Consolidar/parametrizar os seeds 🟢 (código, no repo local; sem tocar servidor)

**Arquivos:** `scripts/seeds/seed-produtos-mae.ts`, `scripts/seeds/seed-usuario-padrao.ts`

- [ ] **T0.1** — Parametrizar o UUID nos dois: trocar `const TENANT_ID = '00000000-...'` por
  `const TENANT_ID = process.env.SEED_TENANT_ID || '00000000-0000-0000-0000-000000000000';`
- [ ] **T0.2** — Alinhar identidade no `seed-usuario-padrao.ts`: nome `'Loucas por Brigadeiro'` + slug `'loucas-por-brigadeiro'` (hoje cria "Loja Chocola Velha" — divergente). Como o seed faz `findOne` antes, se rodar após o produtos-seed ele **encontra** o tenant e só adiciona o usuário; alinhar evita divergência se rodar isolado.
- [ ] **T0.3** — Senha do admin: trocar `DEFAULT_PASSWORD` por `process.env.SEED_ADMIN_PASSWORD || 'senha123'` (o dono passa a senha real no env; nunca commitar a senha).
- [ ] **T0.4** — Verificar bcrypt: `seed-usuario-padrao.ts` usa `require('bcrypt')` (nativo). Confirmar que `bcrypt` está nas deps do backend (senão o app usa `bcryptjs` e o seed precisa alinhar). **Se divergir, corrigir o import** pro mesmo lib do app (`auth.service`).
- [ ] **T0.5** — `cd backend && npm run build` + `npm run lint` nos arquivos tocados. Commit (`chore(seed): parametrize tenant id and consolidate doceria identity`).

**Deliverable:** seeds parametrizáveis por `SEED_TENANT_ID`/`SEED_ADMIN_PASSWORD`, identidade única da doceria, mesmo lib de hash do app.

---

## T1 — PROVAR a sequência COMPLETA no banco de teste 🟢 (gate antes do irreversível)

Estende a prova já feita (migrations) pra incluir **grants + seed com o UUID real**. Não toca o `ucm`.

- [ ] **T1.1** — `git pull` no `/opt/gtsofthub` (traz o T0). *(Ou aplicar T0 direto; decidir no fim do T0.)*
- [ ] **T1.2** — Criar test DB: `docker exec ucm-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -c "CREATE DATABASE ucm_etapa5_test;"'`
- [ ] **T1.3** — Migrar (receita provada):
  ```
  docker run --rm --network container:ucm-postgres -v /opt/gtsofthub/scripts:/app/scripts:ro \
    -e DATABASE_URL=postgresql://postgres@127.0.0.1:5432/ucm_etapa5_test \
    deploy-backend:latest node_modules/.bin/typeorm -d dist/database/data-source.js migration:run
  ```
- [ ] **T1.4** — Grants (`provision-db-user.sh` adaptado ao test DB): rodar os GRANTs + ALTER DEFAULT PRIVILEGES contra `ucm_etapa5_test`.
- [ ] **T1.5** — **Seed (FINALIZAR a mecânica aqui)** — abordagem proposta (validar/ajustar):
  ```
  docker run --rm --network container:ucm-postgres -v /opt/gtsofthub:/repo:ro \
    -e DATABASE_URL=postgresql://postgres@127.0.0.1:5432/ucm_etapa5_test \
    -e SEED_TENANT_ID=2675a300-1f03-4c74-b462-99754fd70eb2 \
    -e SEED_ADMIN_PASSWORD='<senha>' -e NODE_PATH=/app/node_modules \
    -e TS_NODE_PROJECT=/repo/backend/tsconfig.json -w /repo/backend \
    deploy-backend:latest node -r ts-node/register/transpile-only /repo/scripts/seeds/seed-produtos-mae.ts
  ```
  depois o mesmo pra `seed-usuario-padrao.ts`. **Ajustar aqui** o que a prova revelar (NODE_PATH, ts-node, bcrypt, resolução de imports). Rodar como `postgres@127.0.0.1` (bypassa RLS).
- [ ] **T1.6** — **Verificar no test DB:** `migration:show` todas [X]; `store_availability_exceptions` existe; doceria com `id=2675a300-…` + nome "Loucas por Brigadeiro"; admin criado; catálogo (`count(produtos)>0`); `ucm_app` (via `SET ROLE` + `set_config` do tenant) lê os produtos da doceria sob RLS (retorna as linhas com o tenant certo, 0 sem contexto).
- [ ] **T1.7** — Dropar o test DB: `DROP DATABASE ucm_etapa5_test;`.

**Gate:** T1 verde = a sequência completa está provada. **Só então** libera o T2. Documentar o comando de seed final que funcionou.

---

## T2 — Executar contra o `ucm` real 🔴 IRREVERSÍVEL (sem rollback — só após T1 + "ok" do dono)

- [ ] **T2.1 — Reconfirmar dummy NA HORA (verifica-não-confia):**
  ```
  docker exec ucm-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d ucm -tAc \
    "SELECT count(*) FILTER (WHERE status IN ('"'"'paid'"'"','"'"'delivered'"'"')) FROM pedidos;"'
  ```
  Se **≠ 0 → PARA** e reavalia (havia dado real). *(Confirmar o nome exato dos status no schema.)*
- [ ] **T2.2 — 🔴 Zerar schema:** `docker exec ucm-postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d ucm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;"'` — **confirmar antes**.
- [ ] **T2.3 — Migrar** (T1.3 apontando pro `ucm`).
- [ ] **T2.4 — Grants** (`provision-db-user.sh` com `DB_APP_USER`/`DB_APP_PASSWORD` do `.env`, contra `ucm`).
- [ ] **T2.5 — Seed** (comando final do T1.5, `SEED_TENANT_ID=UUID_DOCERIA`, contra `ucm`): produtos-seed → usuario-seed.
- [ ] **T2.6 — Validar no banco:** `migration:show` todas [X]; `store_availability_exceptions` existe; `SELECT id,name FROM tenants` = só a doceria com `2675a300-…`; admin existe; catálogo presente; `ucm_app` lê sob RLS.
- [ ] **T2.7 — Validar a app no ar:** backend health 200; `/admin/configuracoes` 200; **"Próximas exceções" não dá mais 500** (era o sintoma). *(Login ainda exige o 5b.)*

**Sem rollback.** Se algo falhar aqui, não há "up do velho" — por isso o T1 é obrigatório. Falha → parar, diagnosticar com o dono, corrigir e re-provar no test DB.

---

## T3 (Etapa 5b) — Fix do login no ar 🟡 (logo após T2, mesma sessão)

**Arquivos:** `frontend/lib/config.ts`, `frontend/app/login/LoginExperience.tsx`, `deploy/.env`/compose (build arg)

- [ ] **T3.1** — `NEXT_PUBLIC_TENANT_ID=2675a300-…` no build do frontend (env do compose / `deploy/.env`).
- [ ] **T3.2** — Resolver a colisão sentinela×UUID-real no `LoginExperience.tsx`: com tenant configurado, **esconder** o campo workspace e enviar o `x-tenant-id` automaticamente (hoje mostra o UUID cru). Ajustar a lógica `DEFAULT_WORKSPACE`/`showWorkspaceField`.
- [ ] **T3.3** — Rebuild do frontend + `up -d --force-recreate frontend` (só o front).
- [ ] **T3.4** — **Validar login NO AR:** admin (`admin@loja.com` / senha) loga em prod E dev; `/admin/configuracoes` + "Próximas exceções" **200 sem erro**; o dono abre no navegador e confirma.

**Deliverable:** schema (Causa 1) e login (Causa 2) **ambos resolvidos**, validados no ar.

---

## Follow-ups tocados por esta etapa
- **F6** (cron StockSweeper): reavaliar após T2 (banco limpo pode mudar o comportamento).
- **F8/F9/F10:** contornados aqui; fixes definitivos seguem como follow-up.
- Após T2+T3 validados: seguir pra **Etapa 6** (remover `/opt/ucm` velho + lixo) e **Etapa 7** (deploy.sh).
