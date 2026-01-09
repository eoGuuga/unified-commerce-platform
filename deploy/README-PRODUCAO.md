## Deploy de produção (R$100/mês) — 1 VPS + Docker

### O que você vai ter
- **1 VPS** rodando: `nginx (porta 80/443)`, `frontend`, `backend`, `postgres`, `redis`
- **RLS efetivo** (DB user do app sem superuser)
- **Backups diários** do Postgres (script + cron)
- **Backups offsite (B2) + restore drill mensal + alertas** (opcional, mas recomendado)

### Runbook de operação (pós-deploy)
- **Manual de operação completo:** `deploy/RUNBOOK-OPERACAO.md`

### VPS recomendada
- Ubuntu 22.04 LTS
- Ideal: **2 vCPU / 4 GB RAM** (se couber no plano)
- Mínimo: **2 vCPU / 2 GB RAM**

---

## Passo a passo (copiar/colar)

### 1) Subir a VPS e acessar via SSH
No seu PC (Windows), use PowerShell:

```bash
ssh root@SEU_IP_PUBLICO
```

### 2) Colocar o projeto no servidor em `/opt/ucm`
Você pode:
- Subir um `.zip` e extrair no servidor, ou
- Usar `scp`/`rsync` a partir do Windows

Estrutura esperada:
- `/opt/ucm/deploy/docker-compose.prod.yml`
- `/opt/ucm/backend`
- `/opt/ucm/frontend`

### 3) Preparar o servidor (Docker + firewall)
No servidor (depois do projeto estar em `/opt/ucm`):

```bash
cd /opt/ucm
chmod +x deploy/scripts/*.sh
sudo bash deploy/scripts/prod-setup-ubuntu.sh
```

### 4) Criar o arquivo de env de produção
No servidor:

```bash
cd /opt/ucm
cp deploy/env.prod.example deploy/env.prod
nano deploy/env.prod
```

Troque os valores (senhas e segredos).
Dica: por enquanto use `FRONTEND_URL=http://SEU_IP_PUBLICO`.

### 5) Subir Postgres/Redis e preparar o banco

```bash
cd /opt/ucm
docker compose --env-file ./deploy/env.prod -f ./deploy/docker-compose.prod.yml up -d postgres redis

# aplicar migrations
bash deploy/scripts/run-migrations.sh

# criar/garantir usuario do app (RLS real)
set -a
source deploy/env.prod
set +a
bash deploy/scripts/provision-db-user.sh
```

### 6) Subir o app (backend + frontend + nginx)

```bash
docker compose --env-file ./deploy/env.prod -f ./deploy/docker-compose.prod.yml up -d --build
```

Agora abra no navegador:
- `http://SEU_IP_PUBLICO`
- API: `http://SEU_IP_PUBLICO/api/v1/whatsapp/health`

---

## Backups (recomendado)

### 1) Rodar manualmente

```bash
sudo mkdir -p /opt/ucm/backups
sudo bash /opt/ucm/deploy/scripts/backup-postgres.sh
```

### 2) Rodar via cron (todo dia 03:00)

```bash
crontab -e
```

Adicione:

```bash
0 3 * * * cd /opt/ucm && bash deploy/scripts/backup-postgres.sh >> /opt/ucm/backups/backup.log 2>&1
```

---

## Hardening (perfeicao) - recomendado apos subir tudo

No servidor (root):

```bash
cd /opt/ucm
dos2unix deploy/scripts/*.sh
chmod +x deploy/scripts/*.sh
bash deploy/scripts/post-deploy-hardening.sh
```

O que isso faz:
- ajusta permissoes do `deploy/env.prod` (root-only)
- garante UFW com apenas **22/80** (443 fica fechado ate SSL)
- configura cron de backup com log
- habilita unattended upgrades (seguranca)
- habilita fail2ban (SSH)

---

## SSL / domínio (quando você comprar um domínio)
Quando tiver domínio apontando pro IP:
- eu te passo o passo a passo de **Let's Encrypt** e atualizo o `nginx` para 443.

Obs:
- Swagger fica **desativado em producao por padrao** (variavel `ENABLE_SWAGGER=false`) e, mesmo se ativar, o nginx bloqueia acesso externo a `/api/docs`.

---

## Backup offsite (Backblaze B2) + restore drill mensal + alerta Telegram (recomendado)
> Este bloco é opcional, mas é o que deixa o ambiente “nível empresa”: backup fora do VPS e teste periódico de restauração.

### Pré-requisitos
- Ter **backups locais** em `/opt/ucm/backups` (script `deploy/scripts/backup-postgres.sh`)
- Ter conta e bucket no **Backblaze B2**
- Configurar `rclone` no VPS (remotes `b2:` e, recomendado, `b2crypt:`)

### Scripts (no repo, sem segredos)
- `deploy/scripts/backup-offsite.sh` — sobe `.sql.gz` para o remoto e aplica retenção
- `deploy/scripts/restore-drill-offsite.sh` — baixa o último backup e restaura em Postgres temporário (valida contagens)
- `deploy/scripts/notify-telegram.sh` — alerta gratuito no Telegram (quando configurado)

### Variáveis sugeridas (em `deploy/env.prod`)
```bash
# Offsite (rclone)
REMOTE=b2crypt:
OFFSITE_KEEP_DAYS=30

# Alertas Telegram (opcional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

### Exemplo de cron (produção)
```bash
# Backup diário (local + offsite)
0 3 * * * cd /opt/ucm && bash deploy/scripts/backup-postgres.sh >> /opt/ucm/backups/backup.log 2>&1 && bash deploy/scripts/backup-offsite.sh >> /var/log/ucm-backup-offsite.log 2>&1

# Restore drill mensal (alerta Telegram se falhar)
30 4 1 * * set -a; source /opt/ucm/deploy/env.prod; set +a; bash /opt/ucm/deploy/scripts/restore-drill-offsite.sh >> /var/log/ucm-restore-drill.log 2>&1
```

