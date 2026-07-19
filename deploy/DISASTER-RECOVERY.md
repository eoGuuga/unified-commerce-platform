# Disaster Recovery (DR) - UCM/GTSoftHub

Documento de operacao para cenarios de falha. Audita pontos de
recuperacao, tempos objetivos e procedimentos passo-a-passo. Manter
versionado com o repo (`deploy/DISASTER-RECOVERY.md`).

Ultima revisao: 2026-07-19 (Ciclo 2B — off-site religado, provado ao vivo e
tornado permanente). Reler trimestralmente ou apos mudanca de stack.

> **ESTADO DO OFF-SITE (2026-07-19, VERIFICADO ao vivo — nao alegado):**
> **RELIGADO E CIFRADO.** Provas do Bloco 2: (1) upload manual exit 0 (backfill
> de 18 arquivos, 03->18/jul); (2) cifra provada lado a lado — os MESMOS 18
> arquivos legiveis via `b2crypt:` e embaralhados no cru
> `b2:gtsofthub-backups/ucm/`; (3) drill restaurou DO B2 CIFRADO em container
> descartavel com counts do banco real pos-faxina (tenants=1 usuarios=1
> produtos=69); (4) sonda de frescura parseou o modtime REAL (FRESCO, 23h <
> 30h). 3 crons instalados em `/etc/cron.d/` (agenda abaixo). HEAD do checkout
> do servidor: `94834e8`.
>
> **CORRECAO DE PREMISSA (2026-07-15):** o off-site historico (fev->06/jun/2026)
> **SEMPRE foi crypt**. O painel do B2 ENGANA: a pasta `ucm/` legivel e o
> path-base do wrap (nunca cifrado por definicao); o CONTEUDO sempre esteve
> cifrado (nomes embaralhados no remote cru). **Fonte da verdade pro conteudo =
> `rclone lsf`, nao o painel.** A "migracao de 121 legados plain" nao existia;
> a retencao 30d varreu os antigos de mai/jun como politica normal (viram
> hidden versions no B2, recuperaveis no painel ate lifecycle purge).
>
> **CUSTODIA (verificada pelo dono em 15/07/2026, nao alegada):** a senha do
> crypt (`[b2crypt]` — **SEM salt/password2; ao reconstruir o remote, deixar o
> salt VAZIO** senao nao decifra) + a application key do B2, ambas no
> Bitwarden. Perder a senha do crypt = TODOS os backups off-site ilegiveis
> (mesma classe da ENCRYPTION_MASTER_KEY). Divida consciente: re-cifrar com
> salt exigiria re-upload do historico — adiado.
>
> **PROPRIEDADE DA SONDA (conhecida e desejada):** o rclone preserva o modtime
> de ORIGEM (criacao do dump, nao o momento do upload) -> a sonda mede a idade
> do BACKUP e vigia as DUAS cadeias: se o pg_dump local parar e o off-site
> continuar subindo arquivo velho, a idade envelhece e ela grita do mesmo jeito.

### Agenda dos crons (UTC) — escalonada, sem empilhar minuto

| Horario (UTC) | Job | User | Arquivo em /etc/cron.d |
|---|---|---|---|
| `*/5` | app-alert (Tier1 -> Telegram) | ubuntu | `gtsofthub-app-alert` |
| `06:00` diario | backup local (pg_dump+gzip) | ubuntu | `gtsofthub-backup` |
| `06:07` (+00/12/18:07) | sonda de frescura (dead-man 30h) | root | `gtsofthub-offsite-freshness` |
| `06:30` diario | off-site (rclone copy -> b2crypt:) | root | `gtsofthub-backup-offsite` |
| `02:30` dia 1 do mes | restore drill (restaura do B2 + counts) | root | `gtsofthub-restore-drill` |

## Objetivos

| Metrica | Valor objetivo | Como medimos |
|---|---|---|
| **RPO** (Recovery Point Objective) | **24h** | Backup diario `backup-postgres.sh` rodando via cron as 06:00 UTC (03:00 BRT). Pior cenario: perda de dados do dia em curso. |
| **RTO** (Recovery Time Objective) | **2h** para PROD, 4h para reconstrucao completa | Tempo desde "incidente confirmado" ate "sistema rodando + dados restaurados". |
| **Backup retention local** | 14 dias | `KEEP_DAYS=14` (default) em `backup-postgres.sh`. |
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

## Dead-man's switch do off-site (2026-07-12)

O `offsite-freshness-check.sh` (cron `deploy/cron/gtsofthub-offsite-freshness`,
a cada 6h) vigia a IDADE do ULTIMO upload no B2 e alerta no Telegram se passar
de 30h — OU se nao der pra consultar o B2 (fail-closed: estado desconhecido
tambem grita). Existe porque o drill so alertava em FALHA, e nada alertava a
AUSENCIA — foi por isso que a parada de 06/jun/2026 passou ~5 semanas
despercebida.

- **Divida conhecida — "quem vigia a sonda?":** a sonda vigia o off-site, mas
  NADA vigia a sonda. Se o cron dela sumir (a causa exata da parada de jun/2026
  nunca foi identificada), voltamos ao silencio. **Proximo degrau:** heartbeat
  externo (ex.: `healthchecks.io`) — a sonda pinga um servico FORA do VPS, que
  alerta pela ausencia do ping. **Adiado conscientemente:** dependencia externa
  + segredo novo, ganho marginal pequeno frente ao resto da mesa.

## Rotacao da B2 application key — decisao consciente do dono (2026-07-15)

**A application key do B2 NAO sera rotacionada nem tera escopo reduzido agora.**
Decisao do dono, com o risco na mesa:
- A chave PODE ser a master (acesso total a conta B2, inclusive delete do bucket).
- Existem copias possiveis em tarballs NAO inventariados em `/root`
  (`backup-ucm-*20260112*.tar.gz`, de 12/jan) — nao lidos.
- NAO ha evidencia de comprometimento.
- **Gatilho de reversao:** ao primeiro sinal de comprometimento, o primeiro
  movimento e rotacionar com escopo RESTRITO ao bucket (nao master).

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
- `deploy/scripts/offsite-freshness-check.sh` (dead-man's switch)
- `deploy/scripts/test/offsite.test.sh` + `offsite-freshness.test.sh` (testes, fake-rclone)
- `deploy/cron/gtsofthub-backup-offsite`, `-restore-drill`, `-offsite-freshness` (crons versionados)
- `deploy/scripts/restore-drill-offsite.sh`
- `deploy/scripts/apply-and-health.sh`
- `backend/src/database/migrations/` (TypeORM baseline a partir de
  2026-05-15)
- `CLAUDE.md` secao "Backup e disaster recovery"
