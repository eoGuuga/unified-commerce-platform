# Checklist de Release (ProduÃ§Ã£o) â€” gtsofthub.com.br
> **Objetivo:** publicar uma nova versÃ£o com risco mÃ­nimo e rollback rÃ¡pido.
>
> **Regras:** sem segredos neste documento. Tudo sensÃ­vel fica em `/opt/ucm/deploy/.env` (VPS) e em gerenciador de senhas.

---

## Antes de tudo (princÃ­pios)
- **Nunca** faÃ§a deploy â€œna pressaâ€ sem passar pelo mÃ­nimo: build + smoke tests.
- **Sempre** tenha um plano de rollback (voltar container/imagem anterior).
- **Nunca** rode migrations â€œno escuroâ€ sem `ON_ERROR_STOP=1`.
- **Sempre** valide saÃºde do sistema por fora (UptimeRobot) e por dentro (`/health/ready`).

---

## 0) PrÃ©-requisitos (uma vez)
- ProduÃ§Ã£o rodando em `/opt/ucm` (VPS).
- `deploy/.env` com permissÃµes seguras (ideal `600 root:root`).
- Backups:
  - **Local diÃ¡rio:** `deploy/scripts/backup-postgres.sh` (cron)
  - **Offsite B2:** `deploy/scripts/backup-offsite.sh` (cron)
  - **Restore drill mensal:** `deploy/scripts/restore-drill-offsite.sh` (cron + alerta Telegram)
- Monitoramento:
  - UptimeRobot monitorando:
    - `/`
    - `/api/v1/health`
    - `/api/v1/health/live`
    - `/api/v1/health/ready`

ReferÃªncia:
- `deploy/RUNBOOK-OPERACAO.md`

---

## 1) PreparaÃ§Ã£o local (antes do deploy)
### 1.1 Atualizar e validar dependÃªncias (opcional)
- Se houve mudancas de deps, verifique `npm audit` e compatibilidade (sem â€œquebrarâ€ produÃ§Ã£o).

### 1.2 Gates mÃ­nimos (obrigatÃ³rio)
No seu PC (repo):
- **Backend**
  - `npm run lint`
  - `npm run build`
  - `npm run test` (quando aplicÃ¡vel)
- **Frontend**
  - `npm run lint`
  - `npm run build`

> Se tiver E2E de WhatsApp, rode o script E2E antes do deploy quando possÃ­vel.

### 1.3 Checklist de mudancas (obrigatÃ³rio)
- Mudou schema?
  - Garanta que migrations existem e sÃ£o idempotentes (ou seguras).
- Mudou variÃ¡veis de ambiente?
  - Atualize `deploy/env.prod.example` (sem segredos).
  - Atualize `deploy/README-PRODUCAO.md` se houver variÃ¡vel nova.

---

## 2) PreparaÃ§Ã£o no servidor (VPS)
Entre no VPS:
```bash
ssh ubuntu@SEU_IP
sudo -i
cd /opt/ucm
```

### 2.1 Snapshot operacional (5 comandos)
```bash
date -u
docker ps
curl -fsS https://gtsofthub.com.br/api/v1/health/ready >/dev/null && echo "ready=ok"
ls -la /opt/ucm/backups/ | tail -n 5
crontab -l | tail -n 5
```

### 2.2 Backup manual (recomendado antes de deploy com migrations)
```bash
cd /opt/ucm
bash deploy/scripts/backup-postgres.sh
set -a; source /opt/ucm/deploy/.env; set +a
bash deploy/scripts/backup-offsite.sh
```

---

## 3) Deploy (padrÃ£o)
> Ajuste o mÃ©todo de entrega do cÃ³digo conforme seu fluxo (scp/tar/git). A regra Ã©: **cÃ³digo novo chega em `/opt/ucm`**.

### 3.1 Aplicar migrations (se houver)
```bash
cd /opt/ucm
bash deploy/scripts/run-migrations.sh
```

### 3.2 Subir stack (rebuild se mudou cÃ³digo)
```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build
```

### 3.3 Validar Nginx
```bash
docker exec ucm-nginx nginx -t
docker exec ucm-nginx nginx -s reload
```

---

## 4) Smoke tests (obrigatÃ³rio)
```bash
curl -I https://gtsofthub.com.br/
curl -I https://gtsofthub.com.br/api/v1/health
curl -I https://gtsofthub.com.br/api/v1/health/live
curl -I https://gtsofthub.com.br/api/v1/health/ready
curl -I https://www.gtsofthub.com.br/   # deve 301 -> sem www
```

### 4.2 Gate final automatizado (recomendado)
```bash
cd /opt/ucm
TARGET_ENV=prod RUN_TESTS=0 \
bash deploy/scripts/run-final-delivery-gate.sh
```

O script gera relatorio em `deploy/reports/final-gate-prod-<timestamp>.log`.

### 4.1 Verificar logs rÃ¡pidos
```bash
docker logs --tail 200 ucm-backend
docker logs --tail 200 ucm-nginx
```

---

## 5) Rollback (plano)
> Objetivo: voltar em poucos minutos.

### 5.1 Rollback â€œrÃ¡pidoâ€ (imagens anteriores)
Se vocÃª usa `docker compose up -d --build`, o Compose costuma manter imagens antigas localmente.
- Liste imagens:
```bash
docker images | head
```

Se necessÃ¡rio:
- pare e suba com tags especÃ­ficas (quando vocÃª tiver versionamento/tag de imagens).

### 5.2 Rollback com restore de banco (Ãºltimo recurso)
Use o runbook:
- `deploy/RUNBOOK-OPERACAO.md` â†’ seÃ§Ã£o de restore

---

## 6) PÃ³s-release
- Confirmar UptimeRobot â€œUPâ€ nos 4 checks.
- Confirmar logs sem erro em `ucm-backend`.
- Se mudou algo de operaÃ§Ã£o, atualizar:
  - `deploy/RUNBOOK-OPERACAO.md`
  - `deploy/README-PRODUCAO.md`
  - `docs/CONSOLIDADO/01-ESTADO-ATUAL.md` (se for mudanca significativa)

