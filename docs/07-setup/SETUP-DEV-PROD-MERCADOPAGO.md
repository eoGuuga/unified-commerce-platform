# SETUP DEV/PROD - MERCADO PAGO + WEBHOOKS

Purpose: document the exact steps used to make Mercado Pago webhooks work in dev and
what is still pending for production. This file is the single source of truth for
payments/webhooks deployment on the server.

## Scope (server)

- Host: 37.59.118.210
- Dev stack: `/opt/ucm-test-repo/deploy` (docker-compose.test.yml)
- Prod stack: `/opt/ucm/deploy` (docker-compose.prod.yml)
- Nginx entry: `ucm-nginx` handles both prod + dev domains
- Dev domain: `https://dev.gtsofthub.com.br`
- Prod domain: `https://gtsofthub.com.br`

## Required env vars (both dev and prod)

- `PAYMENT_PROVIDER=mercadopago`
- `MERCADOPAGO_ACCESS_TOKEN` (provider auth)
- `MERCADOPAGO_PUBLIC_KEY` (frontend tokenization)
- `MERCADOPAGO_WEBHOOK_TOKEN` (query token guard)
- `MERCADOPAGO_WEBHOOK_URL` (full URL with token)
- `MERCADOPAGO_WEBHOOK_SECRET` (signature validation)
- `REDIS_PASSWORD`
- `REDIS_URL=redis://:PASSWORD@redis:6379`

Dev only:
- `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=true` (panel test can omit signature)

Prod only:
- Do NOT set `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED`.

## Dev checklist (DONE)

- [x] Backend dev image rebuilt from repo clean clone.
- [x] Redis auth aligned (env + container password are the same).
- [x] Nginx routes dev domain to dev containers.
- [x] Mercado Pago webhook test returns `200 OK`.

## Prod checklist (PENDING)

- [ ] Set `MERCADOPAGO_ACCESS_TOKEN` (production).
- [ ] Set `MERCADOPAGO_PUBLIC_KEY` (production).
- [ ] Set `MERCADOPAGO_WEBHOOK_SECRET` (production).
- [ ] Ensure `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED` is NOT set.
- [ ] Rebuild `deploy-backend` image and recreate prod backend.
- [ ] Configure production webhook in Mercado Pago (Payments event).

## Dev commands (reference)

Build image from clean repo:
```bash
cd /home/ubuntu/ucm-clean/unified-commerce-platform/backend
docker build -t ucmtest-backend -f Dockerfile .
```

Force Redis password and backend sync:
```bash
cd /opt/ucm-test-repo/deploy
NEW_REDIS_PASS=$(openssl rand -hex 16)
sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$NEW_REDIS_PASS/" .env
sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://:${NEW_REDIS_PASS}@redis:6379|" .env
docker compose --env-file .env -f docker-compose.test.yml --project-name ucmtest \
  up -d --force-recreate redis backend
```

Validate Redis auth:
```bash
docker exec ucm-redis-test redis-cli -a "$(grep '^REDIS_PASSWORD=' .env | cut -d= -f2)" ping
```

Verify webhook URL:
```bash
grep '^MERCADOPAGO_WEBHOOK_URL=' /opt/ucm-test-repo/deploy/.env
```

## Nginx routing (dev)

File: `/opt/ucm/deploy/nginx/ucm.conf`

Required for dev:
- `proxy_pass http://ucm-backend-test:3001;`
- `proxy_pass http://ucm-frontend-test:3000;`
- `ucm-nginx` must be connected to `ucm-test-net`

Commands:
```bash
docker network connect ucm-test-net ucm-nginx 2>/dev/null || true
sudo sed -i 's|http://ucm-backend-test;|http://ucm-backend-test:3001;|g' /opt/ucm/deploy/nginx/ucm.conf
sudo sed -i 's|http://ucm-frontend-test;|http://ucm-frontend-test:3000;|g' /opt/ucm/deploy/nginx/ucm.conf
docker restart ucm-nginx
```

Local validation (bypass DNS):
```bash
curl -k --resolve dev.gtsofthub.com.br:443:127.0.0.1 https://dev.gtsofthub.com.br/api/v1/health
```

## Production deployment (when keys are ready)

Prepare prod env:
```bash
cd /opt/ucm/deploy
cp /opt/ucm-test-repo/deploy/.env .env
sed -i 's|FRONTEND_URL=.*|FRONTEND_URL=https://gtsofthub.com.br|' .env
sed -i '/^MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=/d' .env
```

Set prod keys (interactive):
```bash
cd /opt/ucm/deploy
read -s -p "MP_ACCESS_TOKEN (prod): " MP_AT; echo
sed -i "s/^MERCADOPAGO_ACCESS_TOKEN=.*/MERCADOPAGO_ACCESS_TOKEN=$MP_AT/" .env
unset MP_AT
```

Rebuild + restart:
```bash
cd /home/ubuntu/ucm-clean/unified-commerce-platform/backend
docker build -t deploy-backend -f Dockerfile .

cd /opt/ucm/deploy
docker compose --env-file .env -f docker-compose.prod.yml up -d --no-deps --force-recreate backend
```

Health check:
```bash
curl -s https://gtsofthub.com.br/api/v1/health
```

Webhook URL for prod:
```bash
grep '^MERCADOPAGO_WEBHOOK_URL=' /opt/ucm/deploy/.env
```

## Notes

- The Mercado Pago panel "test webhook" may send payloads without signature.
  This is why `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=true` exists for dev only.
- In production, always require signature and a valid token.
- Do NOT commit `.env` files to git.
