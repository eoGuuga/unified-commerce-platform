# STATUS UPDATE - 2026-01-14

This file documents the exact server-side changes applied for dev and the current
state of production.

## Dev status (dev.gtsofthub.com.br)

- Webhook Mercado Pago validated (panel test returns 200).
- Redis auth aligned (single password for redis + backend).
- Nginx routes dev domain to dev containers.
- Backend dev uses image built from repo clean clone.

Key URLs:
- `https://dev.gtsofthub.com.br/api/v1/health`
- `POST /api/v1/payments/webhook/mercadopago?token=...`

## Production status (gtsofthub.com.br)

- App is running.
- Mercado Pago is disabled until production credentials are provided.

Missing prod inputs:
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET`

## Nginx fixes applied

- Removed invalid upstream names with underscore.
- Added explicit ports for dev containers:
  - `ucm-backend-test:3001`
  - `ucm-frontend-test:3000`
- Connected `ucm-nginx` to `ucm-test-net`.

## Redis fixes applied (dev)

- Enforced a single password in `.env` and Redis container.
- Forced `REDIS_URL=redis://:PASSWORD@redis:6379`.

## Known expected log noise

- Mercado Pago webhook test uses fake payment ID; backend logs "Payment not found".
  This is expected and the webhook still returns 200 for the panel test.

## Next steps

- Add production Mercado Pago credentials.
- Configure production webhook in Mercado Pago panel.
