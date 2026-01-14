# CHECKLIST FINAL + DEPLOY/ROLLBACK (UCM)

Objetivo: garantir deploy e rollback sem surpresas para producao e teste.
Ambientes:
- Producao: /opt/ucm (https://gtsofthub.com.br)
- Teste: /opt/ucm-test-repo (https://dev.gtsofthub.com.br)

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
  - Teste: `curl -s https://dev.gtsofthub.com.br/api/v1/health`

---

## 2) Deploy seguro (producao)

```
cd /opt/ucm
git status
git pull
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build
curl -s https://gtsofthub.com.br/api/v1/health
```

Se o health falhar:
- verificar logs: `docker logs --tail 200 ucm-backend`
- rollback imediato (ver secao 4).

---

## 3) Deploy seguro (teste)

```
cd /opt/ucm-test-repo
git status
git pull
docker compose --project-name ucmtest --env-file ./deploy/.env -f ./deploy/docker-compose.test.yml up -d --build
curl -s https://dev.gtsofthub.com.br/api/v1/health
```

---

## 4) Rollback imediato

Uso quando o health falha ou erros criticos surgem.

1) Voltar para commit anterior:
```
cd /opt/ucm
git log --oneline -n 5
git reset --hard <commit_anterior>
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build
curl -s https://gtsofthub.com.br/api/v1/health
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

---

## 6) Padrao de alteracao

- Nunca fazer deploy com git sujo.
- Sempre gerar backup antes de um deploy grande.
- Sempre validar health e logs no final.
