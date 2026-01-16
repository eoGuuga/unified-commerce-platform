# CHECKLIST FINAL + DEPLOY/ROLLBACK (UCM)

Objetivo: garantir deploy e rollback sem surpresas para producao e teste.
Ambientes:
- Producao: /opt/ucm (https://gtsofthub.com.br)
- Dev/Teste: /opt/ucm-test-repo (https://dev.gtsofthub.com.br)

---

## 1) Pre-deploy (obrigatorio)

- Confirmar backups recentes:
  - /opt/ucm/backups/backup.log (ultimo OK)
  - /var/log/ucm-backup-offsite.log (ultimo OK)
  - /var/log/ucm-restore-drill.log (ultimo OK)
- Validar status do servidor:
  - `uptime`
  - `ufw status verbose`
  - `fail2ban-client status sshd`
- Validar containers atuais:
  - `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
- Confirmar health atual (baseline):
  - Producao: `curl -s https://gtsofthub.com.br/api/v1/health`
  - Dev: `curl -s https://dev.gtsofthub.com.br/api/v1/health`
- Confirmar cron diario:
  - `crontab -l | grep apply-and-health.sh`

---

## 2) Deploy seguro (prod + dev)

```
sudo -i
/opt/ucm/deploy/scripts/apply-and-health.sh
```

Se o health falhar:
- verificar logs: `docker logs --tail 200 ucm-backend` e `docker logs --tail 200 ucm-backend-test`
- rollback imediato (ver secao 4).

---

## 3) Deploy manual (somente se necessario)

```
# Producao
cd /opt/ucm
git status -sb
git pull --ff-only
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build
curl -s https://gtsofthub.com.br/api/v1/health

# Dev/Teste
cd /opt/ucm-test-repo/deploy
git status -sb
git pull --ff-only
docker compose --env-file ./.env -f ./docker-compose.test.yml --project-name ucmtest up -d --build
curl -s https://dev.gtsofthub.com.br/api/v1/health
```

---

## 4) Rollback imediato

Uso quando o health falha ou erros criticos surgem.

1) Voltar para commit anterior:
```
cd /opt/ucm
git log --oneline -n 5
git checkout <commit_anterior>
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build
curl -s https://gtsofthub.com.br/api/v1/health
```

Para retornar ao main:
```
git checkout main
git pull --ff-only
```

2) Alternativa: restaurar do backup (se necessario):
```
ls -la /opt/ucm/backups
```
Use o script oficial de restore (ver deploy/scripts/restore-drill-offsite.sh).

---

## 5) Pos-deploy (obrigatorio)

- Health OK (prod e teste).
- Conferir logs:
  - `docker logs --tail 200 ucm-backend`
  - `docker logs --tail 200 ucm-nginx`
- Confirmar endpoints criticos (manual):
  - Login
  - Criar produto
  - Criar pedido
- Certificados validos no host:
  - `/etc/letsencrypt/live/gtsofthub.com.br/`
  - `/etc/letsencrypt/live/dev.gtsofthub.com.br/`
- Registrar status final (data/hora, prod+dev OK).

---

## 6) Padrao de alteracao

- Nunca fazer deploy com git sujo.
- Sempre gerar backup antes de um deploy grande.
- Sempre validar health e logs no final.
- 502 durante reload e recreates pode ocorrer temporariamente; o health final deve ser OK.

---

## 7) Operacao diaria (cron)

- Agendado para 19:00:
  - `0 19 * * * /opt/ucm/deploy/scripts/apply-and-health.sh >> /var/log/ucm-apply-health.log 2>&1`
- Log:
  - `tail -n 200 /var/log/ucm-apply-health.log`
