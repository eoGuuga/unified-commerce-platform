# 10 - COMO COMEÇAR

## Setup Local de Desenvolvimento

### Pré-requisitos
- Node.js 18+ ([download](https://nodejs.org))
- Git ([download](https://git-scm.com))
- Conta Supabase ([criar](https://supabase.com))
- Conta Vercel ([criar](https://vercel.com)) - opcional para deploy
- Conta Stripe ([criar](https://stripe.com)) - para testes de pagamento

---

## 1. Criar Repositório GitHub

\`\`\`bash
# Clone do template (quando criar)
git clone https://github.com/seu-usuario/unified-commerce-platform.git
cd unified-commerce-platform

# Ou inicialize do zero
git init
\`\`\`

---

## 2. Setup Supabase

### Criar Projeto

1. Acesse [supabase.com](https://supabase.com)
2. Clique "New Project"
3. Nome: "unified-commerce-platform"
4. Região: São Paulo (Sa America)
5. Senha: Gere uma forte
6. Clique "Create new project"

### Copiar Credenciais

\`\`\`
Após criar, você terá:
- API URL: https://xxx.supabase.co
- Anon Key: (chave pública)
- Service Role Key: (chave privada - GUARDAR)

Criar arquivo .env.local:

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_ADMIN_SECRET_KEY=xxx
\`\`\`

### Criar Schema

Executar scripts SQL em Supabase → SQL Editor:

\`\`\`sql
-- 1. Criar tabela de usuários
CREATE TABLE users (
  id UUID PRIMARY KEY,
  store_id UUID,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'seller',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Continuar com products, inventory, orders, etc (ver 04-DATABASE.md)
\`\`\`

---

## 3. Setup Next.js Localmente

\`\`\`bash
# Criar projeto
npx create-next-app@latest unified-commerce --typescript --tailwind

# Ir para pasta
cd unified-commerce

# Instalar dependências
npm install @supabase/ssr @supabase/supabase-js stripe swr

# Criar pasta de docs
mkdir docs
\`\`\`

---

## 4. Criar Estrutura de Pastas

\`\`\`
unified-commerce/
├── app/
│   ├── layout.tsx (layout raiz)
│   ├── page.tsx (homepage)
│   ├── pdv/
│   │   └── page.tsx (interface PDV)
│   ├── store/
│   │   ├── page.tsx (storefront)
│   │   └── [id]/ (página de produto)
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── dashboard/ (page.tsx)
│   │   ├── orders/ (page.tsx)
│   │   ├── inventory/ (page.tsx)
│   │   └── reports/ (page.tsx)
│   ├── order/
│   │   └── [id]/ (rastreamento)
│   └── api/
│       ├── auth/ (login/logout)
│       ├── products/
│       ├── orders/
│       ├── sales/
│       ├── inventory/
│       ├── payments/ (Stripe webhook)
│       └── whatsapp/ (Twilio webhook)
├── components/
│   ├── ui/ (shadcn components)
│   ├── pdv/ (componentes do PDV)
│   ├── store/ (componentes da loja)
│   └── admin/ (componentes do admin)
├── lib/
│   ├── supabase.ts (cliente Supabase)
│   ├── stripe.ts (cliente Stripe)
│   └── db.ts (queries de banco)
├── docs/ (esta documentação)
└── .env.local (variáveis de ambiente)
\`\`\`

---

## 5. Primeiro Commit

\`\`\`bash
# Add tudo
git add .

# Commit inicial
git commit -m "Initial project setup with documentation"

# Push
git push -u origin main
\`\`\`

---

## 6. Desenvolvendo Phase 1A (Fundação)

### Semana 1: Backend

\`\`\`bash
# Criar API de autenticação
app/api/auth/login/route.ts
app/api/auth/logout/route.ts

# Criar API de produtos
app/api/products/route.ts (GET, POST)

# Criar API de inventário (leitura)
app/api/inventory/route.ts (GET)

# Testes:
npm test -- --coverage
\`\`\`

### Semana 2: Frontend

\`\`\`bash
# Criar página de login
app/login/page.tsx

# Criar layout de admin
app/admin/layout.tsx

# Criar dashboard inicial
app/admin/dashboard/page.tsx

# Testar login
npm run dev
# Acesse http://localhost:3000
\`\`\`

---

## 7. Desenvolvendo Phase 1B (PDV)

### Backend

\`\`\`
Implementar transação crítica:
├─ FOR UPDATE na inventory
├─ Verificar estoque
├─ Abater estoque
├─ Criar pedido
├─ Registrar venda
└─ COMMIT/ROLLBACK
\`\`\`

### Frontend

\`\`\`
Implementar interface PDV:
├─ Busca de produtos
├─ Carrinho visual
├─ Validação de estoque
└─ Comprovante de venda
\`\`\`

---

## 8. Deploy em Produção

### Vercel (Recomendado)

\`\`\`bash
# Conectar GitHub ao Vercel
# 1. Acesse vercel.com
# 2. Clique "Import Project"
# 3. Selecione repositório GitHub
# 4. Vercel detecta Next.js automaticamente
# 5. Adicione variáveis de ambiente:
#    - NEXT_PUBLIC_SUPABASE_URL
#    - NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - SUPABASE_ADMIN_SECRET_KEY
#    - STRIPE_SECRET_KEY (etc)
# 6. Clique "Deploy"

# Ou via CLI:
npm install -g vercel
vercel login
vercel --prod
\`\`\`

---

## 9. Monitoramento em Produção

### Logs
\`\`\`
Vercel Dashboard → Logs
Verificar erros e performance
\`\`\`

### Alerts
\`\`\`
Criar alertas para:
├─ Erro 500 em /api/*
├─ Latência > 1 segundo
├─ Taxa de erro > 1%
└─ Downtime
\`\`\`

### Backups
\`\`\`
Supabase → Backups
Configurar backup automático diário
Testar restore semanal
\`\`\`

---

## 10. Checklist Final (Antes de Cliente Alfa)

- [ ] Banco de dados criado e testado
- [ ] Autenticação funcionando
- [ ] PDV funcional (criar venda)
- [ ] E-commerce funcional (checkout)
- [ ] Nenhum overselling em 100 testes
- [ ] Cache Redis funcionando
- [ ] Auditoria registrando tudo
- [ ] Backup automático configurado
- [ ] HTTPS em todas as requisições
- [ ] RLS habilitado em tabelas
- [ ] Variáveis de ambiente seguras
- [ ] Deploy em produção (Vercel)
- [ ] Documentação atualizada
- [ ] Contato com Cliente Alfa agendado

\`\`\`
