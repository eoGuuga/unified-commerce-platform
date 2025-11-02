# Setup de Variáveis de Ambiente - Backend

Crie um arquivo `.env` na pasta `backend/` com as seguintes variáveis:

```env
# APPLICATION
NODE_ENV=development
PORT=3001
API_VERSION=v1

# DATABASE - Supabase
DATABASE_URL=postgresql://postgres:SENHA@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# REDIS - Upstash
REDIS_URL=https://xxx.upstash.io
REDIS_TOKEN=xxx

# JWT
JWT_SECRET=seu-jwt-secret-super-seguro
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=seu-refresh-secret-super-seguro
JWT_REFRESH_EXPIRATION=7d

# STRIPE
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# TWILIO
WHATSAPP_API_KEY=xxx
WHATSAPP_API_SECRET=xxx

# OPENAI
OPENAI_API_KEY=sk-xxx

# RESEND
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@seu-dominio.com

# SENTRY
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Como Obter as Credenciais

### Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie um projeto
3. Vá em Settings → API
4. Copie as chaves

### Redis (Upstash)
1. Acesse [upstash.com](https://upstash.com)
2. Crie um database
3. Copie URL e Token

### Stripe
1. Acesse [stripe.com](https://stripe.com)
2. Dashboard → Developers → API keys
3. Use chaves de teste inicialmente

### Twilio
1. Acesse [twilio.com](https://twilio.com)
2. Console → API keys & credentials

### OpenAI
1. Acesse [platform.openai.com](https://platform.openai.com)
2. API keys → Create new secret key
