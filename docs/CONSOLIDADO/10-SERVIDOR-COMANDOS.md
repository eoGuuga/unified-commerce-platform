# Servidor - Comandos e Configuracao (Fonte de Verdade)

Ultima atualizacao: 2026-02-16

## Escopo e regras
- Este documento define o passo a passo e os comandos de operacao do servidor.
- Nao inclui segredos. Valores sensiveis ficam somente em `.env` no servidor.
- Sempre confirme o caminho correto antes de rodar comandos destrutivos.

## Mapa de caminhos (VPS)
- Producao (stack principal): `/opt/ucm`
- DEV/TESTE (stack de teste): `/opt/ucm-test-repo`
- Env prod: `/opt/ucm/deploy/.env`
- Env dev/teste: `/opt/ucm-test-repo/deploy/.env`
- Nginx config: `/opt/ucm/deploy/nginx/ucm.conf`
- Scripts operacionais: `/opt/ucm/deploy/scripts/`
- Backups locais: `/opt/ucm/backups/`

## Acesso ao servidor (SSH)
1. Conectar:
```bash
ssh ubuntu@SEU_IP_PUBLICO
```
2. Virar root:
```bash
sudo -i
```
3. Sanity check basico:
```bash
whoami
hostname
pwd
ls -la

docker --version
docker compose version

df -h
free -h
uptime
```

## Comandos do dia a dia (PROD)
### Status geral
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Subir/atualizar stack (sem rebuild)
```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d
```

### Recriar apenas backend/frontend (aplicar env novo)
```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d backend frontend
```

### Rebuild completo
```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build
```

### Reiniciar containers pontuais
```bash
docker restart ucm-backend
docker restart ucm-nginx
docker restart ucm-postgres
docker restart ucm-redis
```

### Logs (tail rapido)
```bash
docker logs --tail 200 ucm-backend
docker logs --tail 200 ucm-nginx
```

### Health checks (prod)
```bash
curl -I https://gtsofthub.com.br/
curl -I https://gtsofthub.com.br/api/v1/health
curl -I https://gtsofthub.com.br/api/v1/health/ready
curl -I https://gtsofthub.com.br/api/v1/health/live
```

## Deploy de producao (passo a passo)
1. Garantir projeto em `/opt/ucm`.
2. Criar/editar env:
```bash
cd /opt/ucm
cp deploy/env.prod.example deploy/.env
nano deploy/.env
```
3. Subir DB/Redis:
```bash
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d postgres redis
```
4. Migrations:
```bash
cd /opt/ucm
bash deploy/scripts/run-migrations.sh
```
5. Criar usuario do app (RLS real):
```bash
cd /opt/ucm
set -a
source deploy/.env
set +a
bash deploy/scripts/provision-db-user.sh
```
6. Subir stack completa:
```bash
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build
```
7. Validar containers + health:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -I https://gtsofthub.com.br/api/v1/health/ready
```

## DEV/TESTE no servidor (stack separado)
### Subir banco e redis dev
```bash
cd /opt/ucm-test-repo
docker compose -f deploy/docker-compose.dev.yml up -d
```

### Stack dev/test completo (backend + frontend + nginx interno)
Observacao: o Nginx de producao roteia o dominio dev para este stack via rede `ucmtest`.

Subir stack completo:
```bash
cd /opt/ucm-test-repo
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.test.yml --project-name ucmtest up -d --build
```

### Migrations no dev (manual, sem risco)
```bash
cd /opt/ucm-test-repo
for migration in scripts/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Aplicando: $(basename "$migration")"
    docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -v ON_ERROR_STOP=1 < "$migration" || echo "Aviso: migration pode ter falhado (ou ja aplicada)"
  fi
done
```

### Criar usuario do app no dev
```bash
docker exec -i ucm-postgres-dev psql -U postgres -d ucm_dev -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ucm_app') THEN
    CREATE ROLE ucm_app LOGIN PASSWORD 'ucm_app_dev_password';
    GRANT CONNECT ON DATABASE ucm_dev TO ucm_app;
    GRANT USAGE ON SCHEMA public TO ucm_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ucm_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ucm_app;
  END IF;
END $$;
SQL
```

### Health checks (dev)
```bash
curl -I https://dev.gtsofthub.com.br/api/v1/health
```

## Nginx (config e reload)
### Aplicar config do repo
```bash
sudo -i
/opt/ucm/deploy/scripts/apply-nginx-config.sh
```

### Validar e recarregar
```bash
docker exec ucm-nginx nginx -t
docker exec ucm-nginx nginx -s reload
```

### Garantir roteamento dev
```bash
sudo -i
/opt/ucm/deploy/scripts/ensure-dev-routing.sh
```

## SSL (Lets Encrypt)
### Certificados no host
- `/etc/letsencrypt/live/gtsofthub.com.br/fullchain.pem`
- `/etc/letsencrypt/live/gtsofthub.com.br/privkey.pem`
- `/etc/letsencrypt/live/dev.gtsofthub.com.br/fullchain.pem`
- `/etc/letsencrypt/live/dev.gtsofthub.com.br/privkey.pem`

### Renovacao (teste)
```bash
certbot renew --dry-run
```

### Script de renovacao
```bash
sudo -i
bash /opt/ucm/deploy/scripts/renew-ssl.sh
```

## Firewall (UFW)
### Estado esperado
- Portas liberadas: `22`, `80`, `443`

### Verificar
```bash
ufw status verbose
```

## Backups (Postgres)
### Backup local manual
```bash
cd /opt/ucm
bash deploy/scripts/backup-postgres.sh
ls -la /opt/ucm/backups/
```

### Backup offsite (rclone)
```bash
bash /opt/ucm/deploy/scripts/backup-offsite.sh
tail -n 80 /var/log/ucm-backup-offsite.log
```

### Restore drill (mensal)
```bash
set -a; source /opt/ucm/deploy/.env; set +a
bash /opt/ucm/deploy/scripts/restore-drill-offsite.sh
tail -n 80 /var/log/ucm-restore-drill.log
```

## Monitoramento e incidentes
### Monitores externos
- https://gtsofthub.com.br/
- https://gtsofthub.com.br/api/v1/health
- https://gtsofthub.com.br/api/v1/health/ready
- https://gtsofthub.com.br/api/v1/health/live

### Fluxo rapido de incidente
1. `ssh` no VPS + `sudo -i`
2. `docker ps`
3. `docker logs --tail 200 ucm-nginx` e `ucm-backend`
4. `docker restart <container>`
5. `curl -I .../health/ready`

## Referencias diretas
- `deploy/RUNBOOK-OPERACAO.md`
- `deploy/README-PRODUCAO.md`
- `deploy/SETUP-DEV-SERVIDOR.md`
- `deploy/SCRIPTS-SSL-SETUP.md`
- `deploy/CHECKLIST-DE-RELEASE.md`
