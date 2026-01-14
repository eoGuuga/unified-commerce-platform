# Setup de Variaveis de Ambiente - Backend

Crie um arquivo `.env` na pasta `backend/` com as seguintes variaveis:

```env
# Application
NODE_ENV=development
PORT=3001
API_VERSION=v1

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=

# JWT
JWT_SECRET=change-me
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=change-me
JWT_REFRESH_EXPIRATION=7d

# Multi-tenant e CSRF
ALLOW_TENANT_FROM_REQUEST=true
CSRF_ENABLED=false
CSRF_COOKIE_NAME=csrf-token
CSRF_HEADER_NAME=x-csrf-token
CSRF_SESSION_HEADER_NAME=x-csrf-session-token

# Pagamentos (Mercado Pago)
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_URL=https://your-domain.com/api/v1/payments/webhook/mercadopago?token=change-me
MERCADOPAGO_WEBHOOK_TOKEN=change-me
MERCADOPAGO_WEBHOOK_SECRET=
# Apenas DEV: liberar webhook sem assinatura (o painel de teste pode omitir assinatura)
MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=false

# Pix (mock fallback)
PIX_KEY=
MERCHANT_NAME=Loja

# WhatsApp
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+5511999999999
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=default

# OpenAI ou Ollama
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=8000
OPENAI_ALLOW_NO_KEY=false

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM=noreply@your-domain.com

# CORS
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=
```

## Observacoes

- Em producao, o tenant vem do JWT. Em dev/test, o header `x-tenant-id` e aceito.
- Para Ollama, defina `OPENAI_ALLOW_NO_KEY=true` e `OPENAI_BASE_URL=http://localhost:11434/v1`.
- Para WhatsApp real, escolha `WHATSAPP_PROVIDER=twilio` ou `WHATSAPP_PROVIDER=evolution`.
- Para CSRF com cookies, habilite `CSRF_ENABLED=true` e envie `x-csrf-token`.
- Separe chaves entre dev e prod. Veja `docs/07-setup/SEPARAR-CHAVES-DEV-PROD.md`.

## Como obter credenciais

### Mercado Pago
1. Acesse https://www.mercadopago.com.br/developers/panel/credentials
2. Use chaves `TEST-` em dev e chaves sem `TEST-` em prod.
3. Copie tambem a `MERCADOPAGO_PUBLIC_KEY` (usada no frontend).
4. Configure o webhook apontando para `/api/v1/payments/webhook/mercadopago` e mantenha `MERCADOPAGO_WEBHOOK_TOKEN` igual ao query param.
5. (Opcional) Se sua conta fornecer assinatura, defina `MERCADOPAGO_WEBHOOK_SECRET` para validar `x-signature`.
6. Dev somente: `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=true` se o painel de teste nao enviar assinatura.

### Twilio
1. Acesse https://www.twilio.com/console
2. Copie Account SID e Auth Token.

### Resend
1. Acesse https://resend.com
2. Gere um API key e configure `EMAIL_FROM`.

### OpenAI
1. Acesse https://platform.openai.com
2. Gere uma API key.
