# Checklist de Release (Produção) — gtsofthub.com.br
> **Objetivo:** publicar uma nova versão com risco mínimo e rollback rápido.
>
> **Regras:** sem segredos neste documento. Tudo sensível fica em `/opt/ucm/deploy/env.prod` (VPS) e em gerenciador de senhas.

---

## Antes de tudo (princípios)
- **Nunca** faça deploy “na pressa” sem passar pelo mínimo: build + smoke tests.
- **Sempre** tenha um plano de rollback (voltar container/imagem anterior).
- **Nunca** rode migrations “no escuro” sem `ON_ERROR_STOP=1`.
- **Sempre** valide saúde do sistema por fora (UptimeRobot) e por dentro (`/health/ready`).

---

## 0) Pré-requisitos (uma vez)
- Produção rodando em `/opt/ucm` (VPS).
- `deploy/env.prod` com permissões seguras (ideal `600 root:root`).
- Backups:
  - **Local diário:** `deploy/scripts/backup-postgres.sh` (cron)
  - **Offsite B2:** `deploy/scripts/backup-offsite.sh` (cron)
  - **Restore drill mensal:** `deploy/scripts/restore-drill-offsite.sh` (cron + alerta Telegram)
- Monitoramento:
  - UptimeRobot monitorando:
    - `/`
    - `/api/v1/health`
    - `/api/v1/health/live`
    - `/api/v1/health/ready`

Referência:
- `deploy/RUNBOOK-OPERACAO.md`

---

## 1) Preparação local (antes do deploy)
### 1.1 Atualizar e validar dependências (opcional)
- Se houve mudanças de deps, verifique `npm audit` e compatibilidade (sem “quebrar” produção).

### 1.2 Gates mínimos (obrigatório)
No seu PC (repo):
- **Backend**
  - `npm run lint`
  - `npm run build`
  - `npm run test` (quando aplicável)
- **Frontend**
  - `npm run lint`
  - `npm run build`

> Se tiver E2E de WhatsApp, rode o script E2E antes do deploy quando possível.

### 1.3 Checklist de mudanças (obrigatório)
- Mudou schema?
  - Garanta que migrations existem e são idempotentes (ou seguras).
- Mudou variáveis de ambiente?
  - Atualize `deploy/env.prod.example` (sem segredos).
  - Atualize `deploy/README-PRODUCAO.md` se houver variável nova.

---

## 2) Preparação no servidor (VPS)
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
set -a; source /opt/ucm/deploy/env.prod; set +a
bash deploy/scripts/backup-offsite.sh
```

---

## 3) Deploy (padrão)
> Ajuste o método de entrega do código conforme seu fluxo (scp/tar/git). A regra é: **código novo chega em `/opt/ucm`**.

### 3.1 Aplicar migrations (se houver)
```bash
cd /opt/ucm
bash deploy/scripts/run-migrations.sh
```

### 3.2 Subir stack (rebuild se mudou código)
```bash
cd /opt/ucm
docker compose --env-file ./deploy/env.prod -f ./deploy/docker-compose.prod.yml up -d --build
```

### 3.3 Validar Nginx
```bash
docker exec ucm-nginx nginx -t
docker exec ucm-nginx nginx -s reload
```

---

## 4) Smoke tests (obrigatório)
```bash
curl -I https://gtsofthub.com.br/
curl -I https://gtsofthub.com.br/api/v1/health
curl -I https://gtsofthub.com.br/api/v1/health/live
curl -I https://gtsofthub.com.br/api/v1/health/ready
curl -I https://www.gtsofthub.com.br/   # deve 301 -> sem www
```

### 4.1 Verificar logs rápidos
```bash
docker logs --tail 200 ucm-backend
docker logs --tail 200 ucm-nginx
```

---

## 5) Rollback (plano)
> Objetivo: voltar em poucos minutos.

### 5.1 Rollback “rápido” (imagens anteriores)
Se você usa `docker compose up -d --build`, o Compose costuma manter imagens antigas localmente.
- Liste imagens:
```bash
docker images | head
```

Se necessário:
- pare e suba com tags específicas (quando você tiver versionamento/tag de imagens).

### 5.2 Rollback com restore de banco (último recurso)
Use o runbook:
- `deploy/RUNBOOK-OPERACAO.md` → seção de restore

---

## 6) Pós-release
- Confirmar UptimeRobot “UP” nos 4 checks.
- Confirmar logs sem erro em `ucm-backend`.
- Se mudou algo de operação, atualizar:
  - `deploy/RUNBOOK-OPERACAO.md`
  - `deploy/README-PRODUCAO.md`
  - `docs/00-projeto/RELATORIO-COMPLETO-DO-PROJETO-2026.md` (se for mudança significativa)

