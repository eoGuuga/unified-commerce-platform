# Disaster Recovery (DR) - UCM/GTSoftHub

Documento de operacao para cenarios de falha. Audita pontos de
recuperacao, tempos objetivos e procedimentos passo-a-passo. Manter
versionado com o repo (`deploy/DISASTER-RECOVERY.md`).

Ultima revisao: 2026-07-12 (Ciclo 2A off-site). Reler trimestralmente ou apos mudanca
de stack.

> **ESTADO DO OFF-SITE (2026-07-12, verificado na fonte):** o off-site rodou de
> 11/fev a **06/jun/2026** (provado restauravel no drill de 01/jun) e **parou em
> silencio** (o cron desapareceu ~06-07/jun; causa nao recuperavel). O
> religamento esta na branch `fix/offsite-reactivation` (path corrigido, retencao
> fail-loud, crons versionados em `deploy/cron/`). **ATENCAO NA RECUPERACAO:** os
> ~121 arquivos JA no bucket foram enviados pelo remote **PLANO `b2:`** (sem
> cifra) — para baixa-los use `b2:`; o religamento passa a usar `b2crypt:` (cifra
> no cliente), entao backups NOVOS ficam sob `b2crypt:`. Num restore, confira os
> DOIS remotes ate a migracao dos antigos ser decidida (Ciclo 2B).

## Objetivos

| Metrica | Valor objetivo | Como medimos |
|---|---|---|
| **RPO** (Recovery Point Objective) | **24h** | Backup diario `backup-postgres.sh` rodando via cron as 06:00 UTC (03:00 BRT). Pior cenario: perda de dados do dia em curso. |
| **RTO** (Recovery Time Objective) | **2h** para PROD, 4h para reconstrucao completa | Tempo desde "incidente confirmado" ate "sistema rodando + dados restaurados". |
| **Backup retention local** | 7 dias | `KEEP_DAYS=7` em `backup-postgres.sh`. |
| **Backup retention offsite (B2)** | 30 dias | `OFFSITE_KEEP_DAYS=30` em `backup-offsite.sh`. |
| **Frequencia do restore drill** | Mensal | `restore-drill-offsite.sh` valida integridade do backup offsite. |

Para upgrade de SLA (99.9% / RPO 1h) seria necessario streaming
replication (Postgres standby) - nao implementado por enquanto.

## Mapa de backups

```
+--------------+   pg_dump+gzip   +----------------+   rclone (REMOTE do .env)  +-------+
|  Postgres    | ---------------> | /opt/gtsofthub | -------------------------> | B2    |
|  (prod)      | (cron 06:00 UTC) | /backups/      | (cron 06:30 UTC)           |       |
+--------------+                  +----------------+                            +-------+
                                      |                                          |
                                      | (retencao 14d local)                     | (retencao 30d offsite)
                                      v                                          v
                                  find -mtime +14                            rclone delete --min-age 30d
```

Componentes:
- `deploy/scripts/backup-postgres.sh`: dump local via `docker exec
  ucm-postgres pg_dump`, salva em `${BACKUP_DIR}/ucm-<timestamp>.sql.gz`
  (BACKUP_DIR derivado do local do script; retencao local 14 dias).
- `deploy/scripts/backup-offsite.sh`: rclone copy do `${BACKUP_DIR}`
  para o B2. **REMOTE vem do `.env`/cron (sem nome hardcoded):** historicamente
  rodou plano (`b2:`); o religamento passa a `b2crypt:` (cifra no cliente).
  Retencao no destino falha ALTO (sem `|| true` engolindo erro).
- `deploy/scripts/restore-drill-offsite.sh`: pull do backup mais
  recente, sobe Postgres temp em container `ucm-postgres-restore-drill`,
  restaura, valida + envia alerta Telegram em caso de falha.

## Cenarios

### Cenario 1 - Dados corrompidos / DELETE acidental

Severidade: alta. RTO 30-60min.

1. **Stop write traffic** (evita pioral): pode pausar bot WhatsApp e
   mostrar manutencao no nginx.
2. Identificar timestamp do incidente nos logs/audit_log.
3. Listar backups disponiveis:
   ```bash
   ls -lh /opt/gtsofthub/backups/
   ```
4. Restaurar para banco temporario para inspecao (NUNCA sobrescrever
   direto):
   ```bash
   docker exec -i ucm-postgres createdb -U postgres ucm_restore_temp
   gunzip -c /opt/gtsofthub/backups/ucm-<TIMESTAMP>.sql.gz | \
     docker exec -i ucm-postgres psql -U postgres -d ucm_restore_temp
   ```
5. Validar dados no `ucm_restore_temp`:
   ```bash
   docker exec -it ucm-postgres psql -U postgres -d ucm_restore_temp \
     -c "SELECT count(*) FROM pedidos WHERE created_at > NOW() - INTERVAL '24 hours';"
   ```
6. Se OK, decidir: full restore (com perda de dados pos-snapshot) OU
   restore selectivo via INSERT FROM SELECT do banco temporario.
7. Apos restore, retomar writes e fazer post-mortem.

### Cenario 2 - Servidor VPS perdido

Severidade: critica. RTO 2-4h.

Pre-requisitos para nova VPS:
- Acesso SSH com chaves backupeadas (1Password / Bitwarden).
- DNS aponta pra IP do servidor (atualizar A record).
- Conta B2 + rclone config (`~/.config/rclone/rclone.conf` com os
  remotes `b2:` e `b2crypt:` configurados). No servidor atual esse conf
  vive em `/root/.config/rclone/rclone.conf` (mode 600).

Passos:
1. Provisionar VPS nova (Ubuntu 22.04+).
2. Instalar Docker + Docker Compose + git + rclone.
3. Clonar repo:
   ```bash
   git clone <repo> /opt/gtsofthub
   cd /opt/gtsofthub
   ```
4. Copiar `deploy/env.prod.example` para `deploy/.env` e preencher
   secrets (do gerenciador de senhas):
   - `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` (>=32 chars),
     `ENCRYPTION_KEY` (>=32 chars).
   - `MERCADOPAGO_*` se for usar.
   - `FRONTEND_URL=https://gtsofthub.com.br`.
5. Subir stack:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml up -d
   ```
6. Pegar o backup mais recente do B2. **Escolha o remote certo:** backups
   ANTIGOS (ate ~06/jun/2026) estao no plano `b2:`; os NOVOS (pos-religamento)
   em `b2crypt:`. Na duvida, liste os dois (`rclone lsf b2:`, `rclone lsf b2crypt:`)
   e pegue o mais recente:
   ```bash
   rclone copy b2crypt: /opt/gtsofthub/backups/ \
     --include "ucm-*.sql.gz" --max-age 25h --min-age 0
   # se vazio (backup antigo), tente o plano:
   # rclone copy b2: /opt/gtsofthub/backups/ --include "ucm-*.sql.gz" --max-age 25h
   ```
7. Restaurar (CUIDADO, vai sobrescrever - DB esta vazia neste cenario):
   ```bash
   latest=$(ls -1t /opt/gtsofthub/backups/ucm-*.sql.gz | head -1)
   gunzip -c "$latest" | \
     docker exec -i ucm-postgres psql -U postgres -d ucm
   ```
8. Aplicar migrations recentes (caso schema do backup esteja atras do
   codigo atual):
   ```bash
   docker exec ucm-backend npm run migration:run
   ```
9. Validar via `apply-and-health.sh`:
   ```bash
   bash deploy/scripts/apply-and-health.sh
   ```
10. Atualizar DNS se IP mudou. Aguardar propagacao (<= 5min com TTL baixo).

### Cenario 3 - Volume Docker do Postgres perdido (mas VPS OK)

Severidade: alta. RTO 30min.

1. Parar stack:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml stop
   ```
2. Recriar volume:
   ```bash
   docker volume rm ucm_postgres_data || true
   ```
3. Subir so o postgres:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml up -d postgres
   ```
4. Restaurar do backup local (pular se nao houver - usar B2):
   ```bash
   latest=$(ls -1t /opt/gtsofthub/backups/ucm-*.sql.gz | head -1)
   gunzip -c "$latest" | docker exec -i ucm-postgres psql -U postgres -d ucm
   ```
5. Subir o resto:
   ```bash
   docker compose -f deploy/docker-compose.prod.yml up -d
   ```
6. Validar via `apply-and-health.sh`.

### Cenario 4 - Schema inconsistente / migrations fora de ordem

Severidade: media. RTO 15-30min.

1. Listar status:
   ```bash
   docker exec ucm-backend npm run migration:show
   ```
2. Se uma migration parou no meio (raro mas possivel):
   ```bash
   docker exec -it ucm-postgres psql -U postgres -d ucm \
     -c "SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 10;"
   ```
3. Decidir: revert + reapply (`migration:revert`) ou ajuste manual com
   `INSERT INTO typeorm_migrations`.

## Validacao periodica

| Frequencia | Procedimento | Responsavel |
|---|---|---|
| Diaria | Cron `backup-postgres.sh` 06:00 UTC; cron `backup-offsite.sh` 06:30 UTC | Automatico |
| Diaria | Dead-man's switch (proposto no Ciclo 2A): alerta se o ULTIMO upload no B2 passar do limiar de idade — grita pela AUSENCIA (foi o gap que deixou 06/jun passar) | Cron independente + Telegram |
| Mensal | `restore-drill-offsite.sh` valida que B2 esta restoravel + envia alerta Telegram em falha | Cron 1o do mes 02:30 UTC |
| Trimestral | Re-ler este doc; validar que secrets do password manager ainda funcionam; simular cenario 2 (VPS perdido) num server descartavel | Solo dev |

## Contatos / Acessos criticos

> **NOTA**: nao versionar secrets reais aqui. Listar APENAS os locais
> onde estao guardados.

- Acesso SSH VPS (chaves privadas): **password manager pessoal**.
- B2 application key + bucket: **password manager pessoal**.
- DNS (registro do dominio): **provedor do dominio** (registro.br /
  GoDaddy / etc - documentar qual).
- Conta Mercado Pago: **email principal do operador**.
- Conta Twilio / Evolution API: **email principal do operador**.
- Telegram bot pra alertas (`TELEGRAM_BOT_TOKEN`): **password manager
  pessoal**.

## Lacunas conhecidas

Nao implementado ainda (gap consciente para revisitar):

- **Streaming replication** (Postgres standby quente). Trade-off: dobra
  custo de Postgres e demanda Patroni/repmgr. Justifica se RPO baixar
  para <1h.
- **Multi-region failover**. Hoje rodamos 1 VPS BR. Para SLA
  multi-empresa premium (99.9%+) considerar.
- **PITR (Point-in-time recovery)** via WAL archiving. Substitui o
  pg_dump diario por recuperacao em qualquer instante. Mais complexo
  de operar.
- **Cold-restore total** (script automatizado para cenario 2). Hoje os
  passos sao manuais; pode virar `deploy/scripts/cold-restore.sh`.

## Referencias

- `deploy/scripts/backup-postgres.sh`
- `deploy/scripts/backup-offsite.sh`
- `deploy/scripts/restore-drill-offsite.sh`
- `deploy/scripts/apply-and-health.sh`
- `backend/src/database/migrations/` (TypeORM baseline a partir de
  2026-05-15)
- `CLAUDE.md` secao "Backup e disaster recovery"
