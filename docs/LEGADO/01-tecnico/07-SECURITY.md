> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# 07 - SEGURANÃ‡A

## PrincÃ­pios de SeguranÃ§a

1. **AutenticaÃ§Ã£o ObrigatÃ³ria:** Todos os endpoints requerem usuÃ¡rio autenticado
2. **AutorizaÃ§Ã£o (RBAC):** Cada aÃ§Ã£o verifica role do usuÃ¡rio
3. **Row Level Security:** Dados isolados por loja (multi-tenant)
4. **Auditoria Total:** Cada operaÃ§Ã£o Ã© registrada
5. **Criptografia:** Dados sensÃ­veis sempre criptografados
6. **PCI Compliance:** Nunca guardar dados de cartÃ£o

---

## AutenticaÃ§Ã£o

### Fluxo de Login

\`\`\`
1. Cliente acessa /login
2. Insere email e senha
3. Frontend envia: POST /api/auth/login { email, password }
4. Backend valida credenciais contra Supabase Auth
5. Se vÃ¡lido: Supabase retorna JWT token
6. Frontend armazena token em cookie (HttpOnly)
7. Cookie Ã© automaticamente enviado em requisiÃ§Ãµes
8. Backend valida JWT em cada requisiÃ§Ã£o
\`\`\`

### Supabase Auth Setup

\`\`\`sql
-- JÃ¡ vem com Supabase
-- UsuÃ¡rios autenticados podem fazer login
-- JWT vÃ¡lido por 1 hora (refresh token: 7 dias)

-- Tabela de usuÃ¡rios:
users (
  id UUID PRIMARY KEY,
  email VARCHAR,
  encrypted_password,
  email_confirmed_at,
  ...
)
\`\`\`

### ImplementaÃ§Ã£o

\`\`\`tsx
// frontend/lib/auth.ts
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw new Error(error.message);
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}
\`\`\`

---

## AutorizaÃ§Ã£o (RBAC)

### Roles

| Role | PermissÃµes |
|------|-----------|
| **admin** | Tudo (criar usuÃ¡rios, configuraÃ§Ãµes, relatÃ³rios) |
| **manager** | RelatÃ³rios, fila de produÃ§Ã£o, usuÃ¡rios |
| **seller** | PDV (vender), ver seu prÃ³prio histÃ³rico |
| **support** | Ver pedidos, responder WhatsApp |

### ImplementaÃ§Ã£o

\`\`\`ts
// backend/middleware/authorize.ts
export async function authorize(userId, requiredRole) {
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  const roleHierarchy = {
    'admin': 4,
    'manager': 3,
    'seller': 2,
    'support': 1
  };
  
  if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
    throw new Error('Insufficient permissions');
  }
}

// Em cada API route:
export async function POST(request) {
  const user = await auth.getUser();
  
  await authorize(user.id, 'seller'); // Verifica role
  
  // Resto da lÃ³gica...
}
\`\`\`

---

## Row Level Security (RLS)

### Conceito
Cada loja sÃ³ acessa seus dados.

### ImplementaÃ§Ã£o

\`\`\`sql
-- Habilitar RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: UsuÃ¡rio sÃ³ vÃª usuÃ¡rios da mesma loja
CREATE POLICY "users_see_own_store_users" ON users
  FOR SELECT
  USING (
    store_id = (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Vendedor sÃ³ vÃª produtos da sua loja
CREATE POLICY "users_see_own_store_products" ON products
  FOR SELECT
  USING (
    store_id = (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: SÃ³ pode criar pedido se for da loja
CREATE POLICY "users_create_own_store_orders" ON orders
  FOR INSERT
  WITH CHECK (
    store_id = (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: SÃ³ pode editar pedido da prÃ³pria loja
CREATE POLICY "users_update_own_store_orders" ON orders
  FOR UPDATE
  USING (
    store_id = (
      SELECT store_id FROM users WHERE id = auth.uid()
    )
  );
\`\`\`

### BenefÃ­cios
- âœ“ **SeguranÃ§a no banco:** Mesmo se alguÃ©m descobrir token, nÃ£o acessa dados de outra loja
- âœ“ **Sem lÃ³gica duplicada:** NÃ£o precisa checar `store_id` em cada query
- âœ“ **EscalÃ¡vel:** Funciona com 1000 lojas ou 10 milhÃµes

---

## Auditoria

### Audit Log

\`\`\`sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(100), -- 'CREATE' | 'UPDATE' | 'DELETE'
  table_name VARCHAR(50),
  record_id UUID,
  old_data JSONB, -- dados antes
  new_data JSONB, -- dados depois
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_store_created ON audit_log(store_id, created_at DESC);
\`\`\`

### Registrar AÃ§Ã£o

\`\`\`ts
async function logAudit(storeId, userId, action, tableName, recordId, oldData, newData) {
  await supabase.from('audit_log').insert({
    store_id: storeId,
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
    ip_address: request.headers['x-forwarded-for'],
    user_agent: request.headers['user-agent']
  });
}

// Uso:
await logAudit(
  storeId,
  userId,
  'UPDATE',
  'inventory',
  productId,
  { current_stock: 5 },
  { current_stock: 3 }
);
\`\`\`

---

## Pagamentos (Stripe)

### Regra: NUNCA Guardar Dados de CartÃ£o

\`\`\`ts
// âŒ ERRADO
const { cardNumber, cvv, expiry } = request.body;
await db.insert('payments', { card_number: cardNumber, ... });

// âœ… CORRETO
// Usar Stripe Payment Intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 3000, // R$ 30.00
  currency: 'brl'
});

// Frontend recebe apenas paymentIntent.client_secret
// Frontend envia dados do cartÃ£o DIRETO para Stripe (nÃ£o passa por nosso servidor)
// Stripe processa e retorna webhook de confirmaÃ§Ã£o
\`\`\`

### Webhook Stripe

\`\`\`ts
// POST /api/v1/payments/webhook/mercadopago
// Verifica assinatura do webhook (que Stripe enviou)
const event = stripe.webhooks.constructEvent(
  request.body,
  request.headers['stripe-signature'],
  STRIPE_WEBHOOK_SECRET
);

if (event.type === 'payment_intent.succeeded') {
  const paymentIntent = event.data.object;
  // Confirmar pedido no banco de dados
}
\`\`\`

---

## Rate Limiting

### ProteÃ§Ã£o contra ataques

\`\`\`ts
// middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'), // 100 requisiÃ§Ãµes por hora
});

export async function checkRateLimit(userId) {
  const { success } = await ratelimit.limit(userId);
  if (!success) {
    throw new Error('Too many requests. Try again later.');
  }
}

// Em cada API route sensÃ­vel:
await checkRateLimit(user.id);
\`\`\`

---

## CORS & CSRF

### CORS
\`\`\`ts
// next.config.js
export default {
  headers: [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://seu-dominio.com' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type' }
      ]
    }
  ]
};
\`\`\`

### CSRF Protection
\`\`\`ts
// Form sempre inclui token CSRF
import { generateCSRFToken } from '@/lib/csrf';

export default function Form() {
  const token = generateCSRFToken();
  
  return (
    <form action="/api/orders" method="POST">
      <input type="hidden" name="csrf_token" value={token} />
      {/* Resto do form */}
    </form>
  );
}

// Backend valida
if (!validateCSRFToken(request.body.csrf_token)) {
  throw new Error('CSRF validation failed');
}
\`\`\`

---

## VariÃ¡veis de Ambiente

\`\`\`env
# .env.local (NUNCA commitar)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Secretas (backend only)
SUPABASE_ADMIN_SECRET_KEY=xxx
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
OPENAI_API_KEY=xxx (para IA do bot)
\`\`\`

---

## Checklist de SeguranÃ§a

- [ ] HTTPS em todas as requisiÃ§Ãµes
- [ ] JWT tokens com expiraÃ§Ã£o (1 hora)
- [ ] Refresh tokens com expiraÃ§Ã£o (7 dias)
- [ ] RLS habilitado em todas as tabelas
- [ ] Rate limiting em endpoints pÃºblicos
- [ ] CORS configurado corretamente
- [ ] CSRF tokens em formulÃ¡rios
- [ ] Senhas hasheadas (Supabase faz isso)
- [ ] Auditoria de tudo (INSERT/UPDATE/DELETE)
- [ ] Backups automÃ¡ticos (Supabase faz)
- [ ] Secrets em variÃ¡veis de ambiente (nÃ£o em cÃ³digo)
- [ ] PCI compliance (Stripe cuida)
- [ ] 2FA opcional para admin

