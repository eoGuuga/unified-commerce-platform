# Faxina do Servidor — Plano de Execução (runbook)

> **Executável lendo este arquivo + o handoff** (`docs/superpowers/handoffs/2026-07-01-faxina-servidor.md`) + o spec (`.../specs/2026-07-01-server-cleanup-design.md`). SSH: `ubuntu@gtsofthub.com.br` (chave, sem senha; sudo sem senha).

**Princípio:** publicar/preservar ANTES de destruir; nunca apagar o velho antes do novo estar no ar e validado. **Cada etapa marcada 🟢 SEGURA ou 🔴 DESTRUTIVA. As 🔴 exigem confirmação do dono antes de rodar.** "Extrair antes de apagar." "Verifica-não-confia" (é servidor).

**Legenda:** 🟢 seguro (reversível/regenerável) · 🔴 destrutivo (confirmar antes) · ✅ health-check · ↩️ rollback.

---

## Etapa 1 — 🟢 Push (rede de segurança primeiro) + `.dockerignore`
Protege os 46 commits ANTES de qualquer mexida no servidor. **Nada no servidor ainda.**

1. **Adicionar `frontend/.dockerignore`** (não existe; evita cache velho no build do front — R-D). Conteúdo espelhando `backend/.dockerignore`, adaptado: ignorar `node_modules`, `.next`, `.git`, `*.log`, `.env*`, `coverage`, `test-results`. Commit: `chore(deploy): add frontend/.dockerignore to prevent stale build context`.
2. **Varredura final de segredo** (o repo é PÚBLICO):
   `git diff origin/main..main | grep -E "^\+" | grep -iE "APP_USR-|ENCRYPTION_KEY=.+|JWT_SECRET=.+|postgres://[^:]+:[^@]+@|sk-[A-Za-z0-9]{20}"` (excluir example/spec/test).
   *(Pré-checado hoje: 0 segredos. Reconfirmar na hora.)* **Se aparecer QUALQUER segredo real → PARA, avisa o dono, não publica.**
3. **Push:** `git push origin main`.
- ✅ `git log origin/main -1` == `git rev-parse HEAD` local (o topo bate). `origin/main` sai de `02deaae`.
- ↩️ n/a (push aditivo; se algo, `git push --force-with-lease` só com ok).

## Etapa 2 — 🟢 Liberar espaço (só cache/imagens órfãs)
Não toca containers UP nem código. Libera ~49GB (build cache) + dangling.
```
ssh ubuntu@gtsofthub.com.br 'df -h / | tail -1; docker builder prune -f; docker image prune -f; df -h / | tail -1'
```
- ✅ Disco cai de ~80% pra ~30-40% (o `-a` de imagens fica pra Etapa 6, DEPOIS do novo validado — pra não apagar as imagens de rollback do prod atual). `docker ps` inalterado (5 UP).
- ↩️ n/a (só remove lixo regenerável).
- **NÃO usar `docker image prune -a` nem `docker system prune -a` aqui** (removeria as imagens `deploy-backend`/`deploy-frontend` atuais = rollback).

## Etapa 3 — 🟢 Consolidar em UM dir limpo (novo AO LADO do velho)
Clone limpo de `origin/main` + **preservar os segredos e a config de nginx/certs** do velho. **`/opt/ucm` intocado (fallback).**
```
# clone (como ubuntu; /opt é root → sudo + chown)
sudo git clone https://github.com/eoGuuga/unified-commerce-platform.git /opt/gtsofthub
sudo chown -R ubuntu:ubuntu /opt/gtsofthub
git -C /opt/gtsofthub log --oneline -1      # == origin/main (o topo do push)
git -C /opt/gtsofthub status                # limpo

# PRESERVAR SECRETS (extrair antes de apagar) — cópia + backup fora de /opt
cp /opt/ucm/deploy/.env   /opt/gtsofthub/deploy/.env
cp /opt/ucm/backend/.env  /opt/gtsofthub/backend/.env
cp /opt/ucm/deploy/.env   ~/backup-prod-deploy-env_$(date +%F).env    # safety
cp /opt/ucm/backend/.env  ~/backup-prod-backend-env_$(date +%F).env

# PRESERVAR nginx config + SSL certs (R-E — confirmar os mounts no compose ANTES):
#   grep -nE "volumes:|nginx|cert|ssl|\.conf" /opt/ucm/deploy/docker-compose.prod.yml
#   copiar deploy/nginx/ e o dir de certs (ex.: /opt/ucm/certs) pro novo dir se NÃO vierem do repo.
```
- ✅ `/opt/gtsofthub` HEAD == origin/main, working tree limpo; `deploy/.env` e `backend/.env` copiados (`wc -l` bate: 62 e 38); backup dos 2 `.env` em `~`; nginx config + certs presentes no dir novo.
- ↩️ `sudo rm -rf /opt/gtsofthub` (não afeta nada em uso).
- **⚠️ CONFIRMAR NA HORA (verifica-não-confia):** onde o compose monta nginx config + certs (grep acima). Se vierem de `/opt/ucm/...` (não do repo), preservar no dir novo. **Não prosseguir pra Etapa 4 sem os certs/nginx no lugar.**

## Etapa 4 — 🔴 Build + swap + validar NO AR (down velho → up novo)
Como é **1 ambiente** e os `container_name` colidem (R-B), o swap é: build (velho ainda UP) → down velho → up novo → validar. Reusa volumes (R-A: `postgres_data`/`redis_data`; zerados na Etapa 5). Ambos os composes têm project name default **`deploy`** (basename do dir) → volumes reusados automaticamente.
```
# 1) BUILD do dir novo (velho continua no ar) — 🟢 até aqui
cd /opt/gtsofthub/deploy
docker compose -f docker-compose.prod.yml --env-file .env build

# 2) SWAP — 🔴 (breve indisponibilidade; nada real)
docker compose -p deploy -f /opt/ucm/deploy/docker-compose.prod.yml --env-file /opt/ucm/deploy/.env down       # SEM -v (preserva volumes!)
cd /opt/gtsofthub/deploy
docker compose -p deploy -f docker-compose.prod.yml --env-file .env up -d
```
- ✅ `docker ps` → 5 UP (postgres/redis/backend/frontend/nginx) do dir novo (`docker inspect ucm-backend --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'` = `/opt/gtsofthub/...`). Health: `curl -k https://gtsofthub.com.br/api/v1/health` (e via localhost). As telas: `curl -I https://gtsofthub.com.br/admin/configuracoes` (200) + `dev.gtsofthub.com.br` idem. **Login real + abrir /admin/configuracoes (4 seções + Exceções) e o PDV** — provar no ar.
- ↩️ **rollback:** `docker compose -p deploy -f /opt/gtsofthub/deploy/docker-compose.prod.yml down` → `docker compose -p deploy -f /opt/ucm/deploy/docker-compose.prod.yml --env-file /opt/ucm/deploy/.env up -d` (volta pro velho, intacto). **NÃO seguir pra Etapa 5 enquanto o novo não estiver provado no ar.**
- **⚠️ jamais `down -v`** (apagaria os volumes do banco antes da hora).

## Etapa 5 — 🔴 Banco: zerar e recriar limpo (migrations do zero + seed)
Com o app NOVO no ar. **Reconfirmar que é o banco dummy ANTES de dropar** (verifica-não-confia).
```
# 0) RECONFIRMAR dummy (não confiar no levantamento — reler agora):
docker exec ucm-postgres psql -U postgres -d ucm -tA -c \
 "SELECT 'pagos='||count(*) FROM pagamentos WHERE status='paid'; SELECT 'entregues='||count(*) FROM pedidos WHERE status='entregue';"
#   => tem que ser 0/0 (nada real). Se != 0 → PARA e avisa o dono.

# 1) parar o backend (evita conexões durante o wipe)
docker compose -p deploy -f /opt/gtsofthub/deploy/docker-compose.prod.yml stop backend

# 2) DROP + recreate schema (como superuser postgres) — 🔴
docker exec ucm-postgres psql -U postgres -d ucm -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;"
#   (+ re-grant ao DB_APP_USER se o schema tiver grants específicos — conferir na hora)

# 3) migrations do zero (usando o ADMIN url — DDL): dentro de um container do backend novo
docker compose -p deploy -f /opt/gtsofthub/deploy/docker-compose.prod.yml run --rm backend npm run migration:run
#   => todas as migrations aplicam sem erro (prova reprodutibilidade). migration:show todas [X].

# 4) SEED da doceria como lojista de exemplo — CONFIRMAR o comando exato na hora (R-F):
#    o repo tem scripts/seeds/seed-produtos-mae.ts (catálogo Loucas por Brigadeiro).
#    docker compose ... run --rm backend node/ts-node <script de seed> (ou o comando documentado).

# 5) subir o backend
docker compose -p deploy -f /opt/gtsofthub/deploy/docker-compose.prod.yml start backend
```
- ✅ `migration:show` = todas [X]; `SELECT count(*) FROM tenants` = só o seed (doceria); as telas funcionam com o banco novo (login, /admin, PDV). Os 16 tenants dummy sumiram.
- ↩️ o banco era dummy (backup em nenhum lugar necessário — nada real); se o seed/migração falhar, o schema fica recriado vazio — re-rodar migrations/seed (idempotente). O app velho não é rollback aqui (o banco é compartilhado pelo volume) — por isso a Etapa 4 tem que estar 100% provada antes.
- **⚠️ CONFIRMAR NA HORA:** o comando exato do seed (R-F); se as migrations rodam com `DATABASE_URL` (app) ou precisam do `DATABASE_ADMIN_URL` (a data-source usa qual? conferir — DDL precisa de admin).

## Etapa 6 — 🔴 Remover o antigo (SÓ agora, novo validado)
```
# EXTRAIR antes de apagar: já temos os .env em ~ (Etapa 3). Conferir se /opt/ucm tem algo único:
sudo ls -la /opt/ucm/backups /opt/ucm/certs 2>/dev/null    # backups do banco dummy (descartável) + certs (JÁ preservados na Etapa 3?)
#   Se os certs de prod vivem em /opt/ucm/certs e NÃO foram copiados → copiar antes.

# containers lixo (parados) — 🔴
docker rm ucm-redis-new ucm-ollama-test ucm-backend-dev

# dirs velhos/lixo — 🔴 (um de cada vez, confirmando)
sudo rm -rf /opt/ucm-repo /opt/ucm-test           # lixo não-git
sudo rm -rf /opt/ucm                              # velho (inclui o aninhado) — SÓ após o novo 100% no ar

# imagens/redes órfãs — 🔴 (agora seguro: novo rodando)
docker image prune -a -f                          # remove imagens não-usadas (as velhas deploy-*)
docker network prune -f                           # remove redes não-usadas (mantém as em uso)
```
- ✅ `sudo ls /opt` = só `gtsofthub` (+ containerd); `docker ps -a` sem lixo; **app ainda UP + healthy** (re-curl health + telas); disco ~20-25%.
- ↩️ os dirs apagados não têm rollback fácil — por isso só aqui, com o novo provado e os secrets/certs preservados. **Cada `rm` confirmado.**

## Etapa 7 — 🟢 Deploy confiável pra frente
```
# criar deploy/scripts/deploy.sh no repo (commit + push):
#   set -euo pipefail
#   cd /opt/gtsofthub && git pull --ff-only
#   cd deploy && docker compose -p deploy -f docker-compose.prod.yml --env-file .env up -d --build
#   curl -fsS -k https://localhost/api/v1/health   # health-check, falha o script se != 200
# documentar em deploy/README (ou CLAUDE.md sec.8): "atualizar = ssh + bash deploy.sh"
```
- ✅ rodar `deploy.sh` uma vez (no-op, já atualizado) → build reusa cache, health passa. Deploy vira 1 comando.
- ↩️ n/a (aditivo).

---

## Ordem de confirmação do dono (as 🔴)
Etapa 4 (swap) · Etapa 5 (drop DB) · Etapa 6 (rm dirs/containers/imagens). Cada uma: eu mostro o comando + o resultado esperado, você confirma, eu rodo, eu verifico (health), reporto. Se qualquer ✅ falhar → PARA + rollback + aviso.

## Confirmações exec-time (verifica-não-confia — não assumir, checar na hora)
- **R-E:** mounts de nginx config + SSL certs no compose (Etapa 3) — preservar se não vierem do repo.
- **R-F:** comando exato do seed da doceria (Etapa 5).
- Migrations: `DATABASE_URL` (app/RLS) vs `DATABASE_ADMIN_URL` (DDL) — a data-source usa o admin? (Etapa 5).
- Volumes (R-A): reusar `deploy_postgres_data`/`deploy_redis_data` (recomendado; zerado na Etapa 5).

## Decisões residuais (pro dono)
- **Volumes (R-A):** reusar os existentes [recomendado] vs frescos?
- **`/opt/ucm/backups`** (backups do banco dummy): descartar [recomendado, é dummy] vs guardar?
- **Nome do dir novo:** `/opt/gtsofthub` [recomendado] — ok?
