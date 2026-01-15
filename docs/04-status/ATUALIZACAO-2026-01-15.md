# Atualizacao 2026-01-15 (prod + dev)

Objetivo: alinhar dev/prod no VPS e resolver falhas de conexao (db/redis).

Resumo do que foi feito (sem segredos):
- Prod: removeu rede de teste do compose de producao (isolar DNS)
- Prod: reset do Redis (cache) e alinhamento de senha com .env
- Prod: alinhamento de senhas do Postgres (postgres + ucm_app)
- Prod: backend voltou com health OK
- Dev: health OK (db + redis)

Checklist de alinhamento (executado no VPS):
- [x] dev health OK em https://dev.gtsofthub.com.br/api/v1/health
- [x] prod health OK em https://gtsofthub.com.br/api/v1/health
- [x] prod sem rede de teste no docker-compose
- [x] redis prod com senha correta e volume resetado
- [x] postgres prod com senhas alinhadas (postgres + ucm_app)
- [x] backend prod usando DATABASE_URL completo
- [ ] SSL com SAN correto (gtsofthub.com.br + www) validado sem -k

Comandos de referencia (sem segredos):
```
# Remover rede de teste do compose de producao
sed -i '/ucmtest-net/d' /opt/ucm/deploy/docker-compose.prod.yml

# Fixar DATABASE_URL no .env
echo "DATABASE_URL=postgresql://DB_APP_USER:DB_APP_PASSWORD@postgres:5432/ucm" >> /opt/ucm/deploy/.env

# Reset redis (cache) e subir com senha do .env
docker rm -f ucm-redis
docker volume rm deploy_redis_data
docker compose --env-file /opt/ucm/deploy/.env -f /opt/ucm/deploy/docker-compose.prod.yml up -d redis

# Alinhar senhas do Postgres
docker exec -u postgres ucm-postgres psql -d ucm -c "ALTER USER postgres WITH PASSWORD 'POSTGRES_PASSWORD';"
docker exec -u postgres ucm-postgres psql -d ucm -c "ALTER USER ucm_app WITH PASSWORD 'DB_APP_PASSWORD';"
```

Pendencia critica:
- Reemitir certificado SSL com SAN correto para gtsofthub.com.br + www
