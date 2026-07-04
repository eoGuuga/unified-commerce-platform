# Pré-voo / plano de deploy — Bloco A (auth hardening) — LEVE, sem migration

**Branch:** `security/bloco-a-token-revocation` (4 commits). **NÃO deployado.** Escopo: backend (auth + tenants) + frontend (logout wiring) + docs. **Sem migration, sem mudança de compose/nginx/env, sem infra nova.**

## Estado (read-only, 2026-07-04) — tudo em sync ✅
- **Local:** `main`=`662835f`; branch `8114e2a` = 4 commits à frente; **não pushada**; working tree limpo.
- **Prod:** HEAD=`662835f` == `origin/main` (`origin/main...HEAD = 0 0`, sem divergência); `PROD_DIRTY=0`; health **200**; `ucm-backend Up`.
- **Redis (a dependência da revogação):** `ucm-redis :: Up 2 days (healthy)`; `redis-cli ping` → `NOAUTH Authentication required` (no ar + com senha); `REDIS_URL` no `.env`. **É infra core, rodando e saudável — a denylist de jti tem onde viver. Nenhuma var/infra nova.**
- **Diff:** só código (auth/tenants + 3 arquivos de front) + docs. **Zero arquivo de migration, zero mudança de deploy config.**

## Sequência do deploy (leve)
0. **(Opcional, rede de segurança)** backup do banco (`BACKUP_DIR=/opt/gtsofthub/backups bash scripts/backup-postgres.sh`) — não há mudança de schema, mas custa pouco.
1. **Merge → main + push → pull:** `git checkout main && git merge --no-ff security/bloco-a-token-revocation && git push origin main`; no servidor `git -C /opt/gtsofthub pull --ff-only`.
2. **Build `--no-cache` (backend + frontend):** `cd /opt/gtsofthub/deploy && docker compose -p deploy -f docker-compose.prod.yml --env-file .env build --no-cache backend frontend`. **Zero downtime** (não toca os containers rodando). Se algum build falhar, PARA.
3. **`up -d`:** `docker compose -p deploy -f docker-compose.prod.yml --env-file .env up -d`. Recria backend + frontend → janela **~15-30s** de API (recreate single-replica). **Sem stop deliberado, sem migration** (não há a janela do deploy do envelope).

**Confirmações da leveza:** sem `ENCRYPTION_MASTER_KEY`-style (nenhum segredo novo no boot); sem `DATABASE_ADMIN_URL`/typeorm (sem migration); Redis já roda. O único requisito de runtime novo — Redis — **já está satisfeito**.

## Validação pós-deploy (foco no que a frente mexe: auth)
> As validações de round-trip de auth precisam de uma **credencial de teste** (ex.: `admin@loja.com`, senha no cofre do dono). O dono roda no momento do deploy, ou me passa a credencial então. As demais são headless.

1. **Boot limpo:** `curl -sf .../api/v1/health` → **200**; logs do backend sem erro; `ucm-redis` healthy.
2. **Login funciona:** `POST /auth/login` (com credencial + `x-tenant-id` da doceria) → **200** + JWT. Uma leitura autenticada (`GET /auth/me` com Bearer) → **200**.
3. **🎯 Logout revoga DE VERDADE no ar:** com o token do passo 2 → `GET /auth/me` = 200 → `POST /auth/logout` (Bearer) = 200 → **`GET /auth/me` com o MESMO token = 401**. (Prova a denylist de jti viva em prod.)
4. **Segundo dispositivo NÃO é afetado:** fazer 2 logins (token A e token B) → `logout` do A → `GET /auth/me` com A = **401**, com B = **200**. (Prova o por-token.)
5. **Register cria SELLER (não admin):** em prod o `POST /auth/register` público é **inerte** (400 — sem contexto de auth pra popular o tenant); a remoção do privesc está provada no unit test. Se houver fluxo autenticado de criação de usuário, validar que o usuário nasce SELLER mesmo mandando `role: admin` (→ 400 pelo whitelist).
6. **Branding só admin:** `PATCH /tenants/branding` com token de um **seller** → **403**; com token **admin** → **200**. (Precisa das 2 credenciais; senão, provado no unit test.)
7. **Smoke normal:** app vende (login OK); headers ainda ativos (`curl -sI` → HSTS/CSP/server sem versão); doceria intacta (`tenants=1, produtos=69, usuarios=1`).

## Rollback (leve — sem migration)
- **Código:** `git revert` do merge na `main` (ou checkout do `662835f`) + `build --no-cache backend frontend` + `up -d` com a imagem anterior.
- **Sem banco:** nenhuma mudança de schema/dado → **nada a restaurar**. (Detalhe: tokens emitidos com jti pós-deploy continuam válidos até expirar mesmo após rollback; a denylist no Redis expira sozinha pelo TTL — sem lixo persistente.)
- Rápido: mesma sequência build+up com o código antigo.

## Nota
As correções **só valem no ar após este deploy** (revogação, senha forte, bcrypt 12, register SELLER, branding admin estão no código, não no runtime atual). Prioridade: média — fecha os HIGH limpos de auth. Deployar em baixo movimento, com uma credencial de teste à mão pra provar o round-trip da revogação.
