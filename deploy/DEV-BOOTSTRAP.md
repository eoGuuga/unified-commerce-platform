# Dev Bootstrap

Objetivo: subir dev/test com dados basicos e smoke tests confiaveis.

## Passos (VPS/dev)

```
cd /opt/ucm-test-repo
chmod +x deploy/scripts/seed-test-tenant.sh \
  deploy/scripts/ensure-dev-routing.sh \
  deploy/scripts/run-migrations-test.sh \
  deploy/scripts/seed-dev-data.sh \
  deploy/scripts/run-dev-smoke.sh \
  deploy/scripts/run-dev-whatsapp-e2e.sh \
  deploy/scripts/run-backend-all-tests.sh \
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
- `deploy/scripts/ensure-dev-routing.sh`:
  conecta o nginx de producao na rede do stack test para roteamento do dominio dev.
- `deploy/scripts/run-migrations-test.sh`:
  aplica migrations no Postgres do stack dev/test.
- `deploy/scripts/seed-dev-data.sh`:
  cria produtos basicos e ajusta estoque via API.
- `deploy/scripts/run-dev-smoke.sh`:
  valida health, login, auth/me, products e orders.
- `deploy/scripts/run-dev-whatsapp-e2e.sh`:
  valida o fluxo completo do WhatsApp no dominio dev.
- `deploy/scripts/run-backend-all-tests.sh`:
  roda unit + integration + acid no backend usando o stack test.
- `deploy/scripts/bootstrap-dev.sh`:
  orquestra tudo (up + seed + smoke).

## Opcional

Para pular o E2E do WhatsApp:

```
SKIP_WA_E2E=true ./deploy/scripts/bootstrap-dev.sh
```

Para rodar todos os testes do backend:

```
./deploy/scripts/run-backend-all-tests.sh
```
