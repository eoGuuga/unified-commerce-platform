# Runbook — Conserto do backup de prod (GTSoftHub)

> **Data:** 2026-07-06 · **Tipo:** operação de servidor (cuidado dobrado) · **Status:** aprovado, execução passo-a-passo com confirmação do dono em cada marco.
> **Régua inegociável:** só-leitura em prod (`pg_dump` + `SELECT count`), **nada** de restart/down/compose, restore **JAMAIS** em prod, mudança de código **via git** (sem editar arquivo no servidor à mão), **reversível** em cada passo.

## Contexto (diagnóstico que motivou)
Investigação só-leitura de 2026-07-06 revelou:
- **Prod sem backup automático.** O `backup-postgres.sh` **não está agendado** em lugar nenhum (nem cron de usuário, nem `/etc/cron.d`, nem systemd timer).
- Único backup: 4 dumps **manuais** em `/opt/gtsofthub/backups/`, todos de **Jul 3-4** (feitos na faxina/deploy). Mais recente: `ucm-20260704-035549.sql.gz`, **~2,5 dias atrás**. São válidos e íntegros (pg_dump completo, PG 15.15, 24 tabelas, ~116KB descompactado), mas **nunca restaurados**.
- Causa raiz de "prod sem backup" = **cron ausente** (não é o script). Bug latente F20 (default `BACKUP_DIR=/opt/ucm/backups`, path velho) é real mas secundário.
- **Achado colateral grave** (frente separada de observabilidade): `ucm-watchdog.service` + 3 crons de monitoramento apontam pro path morto `/opt/ucm` e **falham em loop** — mesma raiz de path da faxina.

## Decisões do dono (2026-07-06)
1. **Fix do script:** opção (c) — **`BACKUP_DIR` derivado do local do script** (segue o deploy; mata a raiz do F20, não remenda).
2. **Cron:** 03:00 BRT (06:00 UTC), rotação **14 dias**, **versionado em `/etc/cron.d/` via repo** (config que só vive no servidor foi o que se perdeu na faxina — versionar no git é aprender com o erro).
3. **Off-site:** registrar como **fast-follow** (backup no mesmo disco não protege contra a VPS morrer). **NÃO executar agora** — só registrar no roadmap.

---

## Passo 0 — Backup manual fresco AGORA (o dono está 2,5 dias descoberto)
**Objetivo:** fechar a janela de exposição já, com a ação de menor risco. `pg_dump` é read-only (snapshot consistente, não trava nada).
**Comando (remoto, read-only em prod, arquivo novo — sem rotação/set-e):**
```bash
TS=$(date +%Y%m%d-%H%M%S)
F=/opt/gtsofthub/backups/ucm-manual-${TS}.sql.gz
docker exec -i ucm-postgres pg_dump -U postgres -d ucm | gzip > "$F"
```
**Validação (o que confirma sucesso):** `gzip -t` íntegro; tamanho plausível (KB, não ~20 bytes); cabeçalho `PostgreSQL database dump`; `CREATE TABLE` = 24; rodapé com `\unrestrict` (dump completou).
**Reversível:** é só um arquivo novo — `rm` desfaz. **PARA e confirma com o dono.**

## Passo 1 — Provar o restore (isolado, no `ucm-postgres-test`) 🎯 o passo mais importante
**Isolamento:** `ucm-postgres-test` é container + volume SEPARADOS de prod; restauro num DB **descartável** (`ucm_restore_check`), nunca no `ucm` (prod) nem no `ucm_test_motor` (testes). Prod só recebe 1 query read-only de contagem.
```bash
# 0. versao do PG do container de teste (casar 15.15 p/ o \restrict do dump)
docker exec ucm-postgres-test psql -U postgres -c "SELECT version();"
# 1. DB descartavel
docker exec ucm-postgres-test psql -U postgres -c "CREATE DATABASE ucm_restore_check;"
# 2. restaurar o dump fresco (ON_ERROR_STOP=1 -> erro aborta)
LATEST=$(ls -t /opt/gtsofthub/backups/ucm-*.sql.gz | head -1)
zcat "$LATEST" | docker exec -i ucm-postgres-test psql -v ON_ERROR_STOP=1 -U postgres -d ucm_restore_check
# 3. verificar schema + dados
docker exec ucm-postgres-test psql -U postgres -d ucm_restore_check -c \
  "SELECT count(*) tabelas FROM information_schema.tables WHERE table_schema='public';"
docker exec ucm-postgres-test psql -U postgres -d ucm_restore_check -c \
  "SELECT (SELECT count(*) FROM tenants) tenants,(SELECT count(*) FROM usuarios) usuarios,(SELECT count(*) FROM produtos) produtos,(SELECT count(*) FROM pedidos) pedidos,(SELECT count(*) FROM pagamentos) pagamentos;"
# 4. comparar com PROD (READ-ONLY)
docker exec ucm-postgres psql -U postgres -d ucm -c \
  "SELECT (SELECT count(*) FROM tenants) tenants,(SELECT count(*) FROM usuarios) usuarios,(SELECT count(*) FROM produtos) produtos,(SELECT count(*) FROM pedidos) pedidos,(SELECT count(*) FROM pagamentos) pagamentos;"
# 5. cleanup
docker exec ucm-postgres-test psql -U postgres -c "DROP DATABASE ucm_restore_check;"
```
**Sucesso:** restore sai 0 sem `ERROR`; tabelas = 24; contagens batem com prod (delta mínimo do tempo desde o dump). **Reversível:** dropa o DB de teste. **PARA e confirma.**

## Passo 2 — Corrigir o script (via git, sem editar no servidor)
Branch `fix/backup-script`. Novo `deploy/scripts/backup-postgres.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
# Cron: 0 6 * * * cd /opt/gtsofthub && bash deploy/scripts/backup-postgres.sh >> backups/backup.log 2>&1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"   # derivado; segue o deploy (mata o F20)
KEEP_DAYS="${KEEP_DAYS:-14}"
CONTAINER="${PG_CONTAINER:-ucm-postgres}"
DB="${PG_DB:-ucm}"
mkdir -p "${BACKUP_DIR}"
if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "ERRO: container ${CONTAINER} nao esta rodando — abortando." >&2; exit 1
fi
ts="$(date +%Y%m%d-%H%M%S)"; final="${BACKUP_DIR}/ucm-${ts}.sql.gz"; tmp="${final}.tmp"
echo "[$(date -Is)] Gerando: ${final}"
if docker exec -i "${CONTAINER}" pg_dump -U postgres -d "${DB}" | gzip > "${tmp}"; then
  if gzip -t "${tmp}" && [ "$(stat -c%s "${tmp}")" -gt 1024 ]; then
    mv "${tmp}" "${final}"; echo "[$(date -Is)] OK: $(stat -c%s "${final}") bytes"
  else rm -f "${tmp}"; echo "ERRO: dump invalido/minusculo — descartado." >&2; exit 1; fi
else rm -f "${tmp}"; echo "ERRO: pg_dump falhou — nenhum backup." >&2; exit 1; fi
echo "[$(date -Is)] Rotacionando (>${KEEP_DAYS}d)..."
find "${BACKUP_DIR}" -type f -name "ucm-*.sql.gz" -mtime "+${KEEP_DAYS}" -delete || true
echo "[$(date -Is)] Concluido."
```
Deploy: commit → push → no servidor `cd /opt/gtsofthub && git pull` (mantém `== origin/main`, sem drift). **Reversível:** `git revert`. **PARA e confirma.**

## Passo 3 — Agendar o cron (versionado)
Novo arquivo no repo `deploy/cron/gtsofthub-backup`:
```cron
# Backup diario do Postgres de prod — 03:00 BRT (06:00 UTC), rotacao 14d
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 6 * * * ubuntu cd /opt/gtsofthub && bash deploy/scripts/backup-postgres.sh >> /opt/gtsofthub/backups/backup.log 2>&1
```
Instalar (requer sudo; se pedir senha, para e avisa): `sudo install -m 644 -o root -g root deploy/cron/gtsofthub-backup /etc/cron.d/gtsofthub-backup` (nome sem ponto, senão o cron ignora). **Reversível:** `sudo rm /etc/cron.d/gtsofthub-backup`. **PARA e confirma.**

## Passo 4 — Validar 1 run agendado
Disparar o script já corrigido (`cd /opt/gtsofthub && bash deploy/scripts/backup-postgres.sh`), confirmar: dump novo com prefixo `ucm-<ts>`, log escrito, rotação **não** apagou os recentes (<14d). **PARA e confirma.**

---

## Fast-follow (registrado, NÃO neste conserto)
- **Cópia off-site dos backups.** Hoje ficam no mesmo disco da VPS → protege contra corrupção/deploy-ruim/delete, **não** contra perda da VPS. Opções: `scp`/`rclone` pra fora, object storage, ou o dono baixando. Registrado no roadmap.
- **Watchdog + 3 crons de monitoramento mortos** (`/opt/ucm` → `/opt/gtsofthub`) — mesma raiz de path; entra na **frente de observabilidade** (🔴 do roadmap).

## Reversibilidade (resumo)
| Passo | Toca prod | Reversível por |
|---|---|---|
| 0 backup manual | só leitura | `rm` do arquivo |
| 1 restore isolado | 1 query read-only | `DROP DATABASE` no test |
| 2 fix script | não | `git revert` |
| 3 cron | não | `rm /etc/cron.d/...` |
| 4 validar | só leitura | — |
