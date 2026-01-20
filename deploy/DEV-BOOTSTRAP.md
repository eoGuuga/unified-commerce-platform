# Dev Bootstrap

Objetivo: subir dev/test com dados basicos e smoke tests confiaveis.

## Passos (VPS/dev)

```
cd /opt/ucm-test-repo
chmod +x deploy/scripts/seed-test-tenant.sh \
  deploy/scripts/seed-dev-data.sh \
  deploy/scripts/run-dev-smoke.sh \
  deploy/scripts/bootstrap-dev.sh

./deploy/scripts/bootstrap-dev.sh
```

## Atalho (1 comando)

```
./deploy/scripts/dev-up.sh
```

## Scripts

- `deploy/scripts/seed-test-tenant.sh`:
  garante tenant de teste no banco.
- `deploy/scripts/seed-dev-data.sh`:
  cria produtos basicos e ajusta estoque via API.
- `deploy/scripts/run-dev-smoke.sh`:
  valida health, login, auth/me, products e orders.
- `deploy/scripts/bootstrap-dev.sh`:
  orquestra tudo (up + seed + smoke).
