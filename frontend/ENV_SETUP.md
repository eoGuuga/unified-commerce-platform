# Setup de Variáveis de Ambiente - Frontend

Crie um arquivo `.env.local` na pasta `frontend/` com as seguintes variáveis:

```env
# APPLICATION
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="Unified Commerce Platform"

# BACKEND API
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
API_URL=http://localhost:3001

# SUPABASE (Public Keys)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# AUTHENTICATION
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_JWT_STORAGE_KEY=ucm-access-token

# STRIPE (Public Key)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# FEATURES
NEXT_PUBLIC_ENABLE_WHATSAPP_BOT=true
NEXT_PUBLIC_ENABLE_ECOMMERCE=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true

# SUPPORT
NEXT_PUBLIC_SUPPORT_EMAIL=suporte@seu-dominio.com
NEXT_PUBLIC_SUPPORT_PHONE=+5511999998888
```

## Importante

- Toda variável pública (usada no navegador) deve começar com `NEXT_PUBLIC_`
- Variáveis sem esse prefixo são apenas server-side
- Nunca commite o arquivo `.env.local` no Git
