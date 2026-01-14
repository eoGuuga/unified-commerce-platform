# RUNBOOK de Operação — gtsofthub.com.br (Produção)
> **Objetivo:** ser o manual “de guerra” (operação) do ambiente de produção da UCM.
>
> **Este documento NÃO contém segredos.** Tokens/senhas ficam apenas no servidor (ex.: `/opt/ucm/deploy/.env`) e em gerenciador de senhas.

---

## Visão geral (arquitetura em produção)
- **Domínio oficial:** `https://gtsofthub.com.br` (sem www)
- **WWW:** `https://www.gtsofthub.com.br` → 301 para o domínio oficial
- **Servidor:** 1 VPS Ubuntu
- **Projeto no VPS:** `/opt/ucm`
- **Orquestração:** Docker Compose (`deploy/docker-compose.prod.yml`)
- **Reverse proxy:** Nginx (container `ucm-nginx`)

### Containers (nomes)
- `ucm-nginx` (80/443 público)
- `ucm-frontend` (interno :3000)
- `ucm-backend` (interno :3001)
- `ucm-postgres` (interno :5432)
- `ucm-redis` (interno :6379)

---

## URLs e checks
### Site
- **Oficial:** `https://gtsofthub.com.br/`

### API
- `https://gtsofthub.com.br/api/v1/health`
- `https://gtsofthub.com.br/api/v1/health/ready`
- `https://gtsofthub.com.br/api/v1/health/live`

### Swagger (produção)
- Por padrão o backend roda com `ENABLE_SWAGGER=false`.
- Mesmo se ativar, o Nginx bloqueia `/api/docs` e `/api/docs-json` externamente.

---

## Acesso ao servidor (SSH)
- Logar como `ubuntu` e elevar para root:

```bash
sudo -i
```

---

## Comandos “padrão ouro” (dia a dia)
### Status dos containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Subir/atualizar stack (sem rebuild)
```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d
```

### Recriar apenas backend/frontend (pegar env novo)
```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d backend frontend
```

### Reiniciar um container
```bash
docker restart ucm-backend
```

### Logs (tail)
```bash
docker logs --tail 200 ucm-backend
docker logs --tail 200 ucm-nginx
```

### Teste rápido (headers)
```bash
curl -I https://gtsofthub.com.br/
curl -I https://gtsofthub.com.br/api/v1/health/ready
curl -I https://www.gtsofthub.com.br/
```

---

## Nginx (config e reload)
### Arquivo de configuração
- `/opt/ucm/deploy/nginx/ucm.conf`
### Dev domain (se ativo)
- `https://dev.gtsofthub.com.br` aponta para o stack de teste.
- O container `ucm-nginx` deve estar conectado na rede `ucm-test-net`:
```bash
docker network connect ucm-test-net ucm-nginx 2>/dev/null || true
```


### Validar e recarregar
```bash
docker exec ucm-nginx nginx -t
docker exec ucm-nginx nginx -s reload
```

---

## Firewall (UFW)
### Estado esperado
- Portas liberadas: **22**, **80**, **443**

### Verificar
```bash
ufw status verbose
```

---

## SSL (Let’s Encrypt)
### Certificados no host
- `/etc/letsencrypt/live/gtsofthub.com.br/fullchain.pem`
- `/etc/letsencrypt/live/gtsofthub.com.br/privkey.pem`
- `/etc/letsencrypt/live/dev.gtsofthub.com.br/fullchain.pem`
- `/etc/letsencrypt/live/dev.gtsofthub.com.br/privkey.pem`

### Renovação (teste)
```bash
certbot renew --dry-run
```

> Observação: se a emissão foi feita via `--standalone`, a renovação pode precisar parar o Nginx. Se você já tem hooks configurados em `/etc/letsencrypt/renewal-hooks/`, mantenha-os.

---

## Backups (Postgres)
### Backup local diário (cron)
O servidor roda, diariamente, um backup local e depois um upload offsite:
- **Local:** `/opt/ucm/backups/ucm-YYYYMMDD-HHMMSS.sql.gz`
- **Logs do backup local:** `/opt/ucm/backups/backup.log`

Ver cron:
```bash
crontab -l
```

### Rodar backup manual (local)
```bash
cd /opt/ucm
bash deploy/scripts/backup-postgres.sh
ls -la /opt/ucm/backups/
```

---

## Backup offsite (Backblaze B2 via rclone)
### Pré-requisitos
- `rclone` instalado e configurado no VPS:
  - remote `b2:` (B2)
  - remote `b2crypt:` (crypt em cima do B2) — recomendado

### Rodar upload offsite manual
```bash
bash /opt/ucm/deploy/scripts/backup-offsite.sh
tail -n 80 /var/log/ucm-backup-offsite.log
```

### Ver arquivos no remoto (criptografado)
```bash
rclone ls b2crypt: | tail -n 20
```

> **Crítico:** guarde com segurança a senha do `b2crypt` (crypt). Sem isso, não existe restore.

---

## Restore drill mensal (teste de restauração real) + alerta Telegram
### O que é
Todo mês, o servidor:
1) baixa o último backup do `b2crypt:`
2) restaura em um Postgres temporário
3) valida contagens mínimas (`tenants`, `usuarios`)
4) se falhar, envia alerta no Telegram

### Script
- `/opt/ucm/deploy/scripts/restore-drill-offsite.sh`
- Log: `/var/log/ucm-restore-drill.log` (com logrotate)

### Rodar manualmente
```bash
set -a; source /opt/ucm/deploy/.env; set +a
bash /opt/ucm/deploy/scripts/restore-drill-offsite.sh
tail -n 80 /var/log/ucm-restore-drill.log
```

### Testar alerta (falha controlada)
```bash
set -a; source /opt/ucm/deploy/.env; set +a
REMOTE="b2crypt:nao-existe/" bash /opt/ucm/deploy/scripts/restore-drill-offsite.sh || true
```

### Variáveis no .env (sem expor valores aqui)
- `TELEGRAM_BOT_TOKEN=...`
- `TELEGRAM_CHAT_ID=...`

---

## Monitoramento externo (UptimeRobot)
### Monitores recomendados
- `https://gtsofthub.com.br/`
- `https://gtsofthub.com.br/api/v1/health`
- `https://gtsofthub.com.br/api/v1/health/live`
- `https://gtsofthub.com.br/api/v1/health/ready`

### O que fazer quando alertar DOWN
1) Verificar se o VPS responde (SSH)
2) Ver containers (`docker ps`)
3) Ver logs (`docker logs --tail 200 ucm-backend` e `ucm-nginx`)
4) Reiniciar o serviço afetado (`docker restart ucm-backend`, etc.)
5) Re-testar endpoints (`curl -I .../health/ready`)

---

## Procedimento de incidentes (curto)
### Sintoma: site fora (timeout)
1) `ssh ubuntu@SEU_IP`
2) `sudo -i`
3) `docker ps` (ver se `ucm-nginx` está Up)
4) `docker logs --tail 200 ucm-nginx`
5) `docker restart ucm-nginx`

### Sintoma: API fora, mas site abre
1) `docker ps` (ver `ucm-backend`)
2) `docker logs --tail 200 ucm-backend`
3) `docker restart ucm-backend`
4) `curl -I https://gtsofthub.com.br/api/v1/health/ready`

### Sintoma: health/ready falha por DB/Redis
1) `docker ps` (postgres/redis “healthy”?)
2) `docker logs --tail 200 ucm-postgres`
3) `docker logs --tail 200 ucm-redis`
4) reiniciar o serviço que falhou:
   - `docker restart ucm-postgres`
   - `docker restart ucm-redis`

---

## Checklist de “perfeição” (estado atual)
- **HTTPS ativo (443)** ✅
- **HTTP→HTTPS (301)** ✅
- **www→raiz (301)** ✅
- **HSTS ativo** ✅
- **UFW 22/80/443** ✅
- **Backups local + offsite (B2 criptografado)** ✅
- **Restore drill mensal + alerta Telegram** ✅
- **Logrotate** (backup/offsite/restore drill) ✅
- **Monitoramento externo** ✅

---

## Documentos relacionados (governança)
- **Release sem risco:** `deploy/CHECKLIST-DE-RELEASE.md`
- **Onboarding do 2º dev:** `deploy/ONBOARDING-SEGUNDO-DEV.md`

