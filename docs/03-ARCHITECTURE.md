# 03 - ARQUITETURA TÉCNICA

## Visão Geral de 4 Camadas

\`\`\`
┌─────────────────────────────────────────────────────────┐
│ CAMADA 1: APRESENTAÇÃO (Frontend)                       │
│  - Next.js Pages (PDV, E-commerce, Admin Dashboard)    │
│  - React Components (reusáveis)                         │
│  - Tailwind CSS (styling)                               │
│  - SWR (data fetching & cache)                          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/HTTPS
                       ▼
┌─────────────────────────────────────────────────────────┐
│ CAMADA 2: API & APLICAÇÃO (Backend)                     │
│  - Next.js Route Handlers (/api/...)                   │
│  - Server Actions (forma RPC)                           │
│  - Business Logic (Inventory Manager, Order Manager)    │
│  - Transaction Handling (ACID)                          │
│  - Event Bus (notificações em tempo real)              │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL
                       ▼
┌─────────────────────────────────────────────────────────┐
│ CAMADA 3: DADOS (Database + Cache)                      │
│  - PostgreSQL (Supabase): Transações ACID               │
│  - Redis (Upstash): Cache de estoque & sessões         │
│  - Row Level Security (RLS): Isolamento por loja       │
│  - Triggers & Constraints: Regras no banco              │
└──────────────────────┬──────────────────────────────────┘
                       │ APIs
                       ▼
┌─────────────────────────────────────────────────────────┐
│ CAMADA 4: INTEGRAÇÕES (Serviços Terceiros)             │
│  - Stripe: Processamento de pagamentos                  │
│  - Twilio: WhatsApp Bot                                │
│  - OpenAI: IA conversacional                            │
│  - Resend: Email                                        │
│  - Vercel Blob: Storage de imagens                     │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Componentes Principais

### Frontend (Camada 1)

**Interface PDV (Loja Física)**
- Busca de produtos (autocomplete)
- Carrinho visual com estoque em tempo real
- Processamento de venda
- Comprovante gerado
- Modo offline (localStorage sync)
- **Tech:** Next.js App Router + React + Tailwind + SWR

**E-commerce (Storefront)**
- Homepage com catálogo
- Página de produto (fotos, descrição)
- Carrinho de compras
- Checkout de uma página
- Rastreamento de pedido
- **Tech:** Next.js SSG/SSR + Server Components + Stripe

**Admin Dashboard**
- KPIs de hoje (vendas, pedidos, estoque)
- Relatórios de vendas (filtros, export)
- Gestão de estoque
- Fila de produção (real-time)
- Gestão de usuários
- **Tech:** Next.js Client Components + Recharts + SWR

### Backend (Camada 2)

**API de Autenticação**
- Login/Logout (Supabase Auth)
- JWT token validation
- Session management
- **Endpoints:** POST /api/auth/login, /api/auth/logout

**API de Produtos**
- GET /api/products (listar)
- POST /api/products (criar) [admin only]
- PUT /api/products/:id (editar) [admin only]
- **Filtros:** Categoria, busca por nome, estoque

**API de Vendas (Crítica)**
- POST /api/sales (registrar venda)
- **Fluxo:**
  \`\`\`
  1. Validar entrada
  2. Iniciar TRANSAÇÃO
  3. FOR UPDATE na inventory (lock pessimista)
  4. Verificar estoque
  5. Abater estoque
  6. Criar pedido
  7. Registrar venda
  8. COMMIT ou ROLLBACK
  \`\`\`

**API de Inventário**
- GET /api/inventory (verificar estoque)
- PUT /api/inventory/:id (repor)
- **Cache:** Redis com TTL de 1 segundo

**API de Ordens**
- GET /api/orders (listar)
- PUT /api/orders/:id (atualizar status)
- **Realtime:** WebSocket para atualizações

**API de Relatórios**
- GET /api/reports/sales (vendas por período/canal)
- GET /api/reports/products (produtos mais vendidos)
- GET /api/reports/trends (trends semanais)

### Banco de Dados (Camada 3)

**PostgreSQL (Supabase)**
- Tabelas: users, products, inventory, orders, order_items, sales_transactions, payments, audit_log
- Transações ACID garantem atomicidade
- Triggers para auditoria automática
- Índices para performance

**Redis (Upstash)**
- Cache de produtos: TTL 60s
- Cache de estoque: TTL 1s (muito curto para ser preciso)
- Sessões de carrinho: TTL 24h

**Row Level Security (RLS)**
- Cada usuário só vê dados de sua loja
- Políticas de segurança no Supabase
- Não precisa checar store_id em código

### Integrações (Camada 4)

**Stripe (Pagamentos)**
- Payment Intent para checkout
- Webhook para confirmação
- Nunca guardar dados de cartão (PCI compliance)

**Twilio (WhatsApp)**
- Receber mensagens (webhook)
- Enviar mensagens
- Webhook para confirmação

**OpenAI (IA)**
- Processamento de linguagem natural
- Entender intenção do cliente
- Gerar respostas naturais

**Resend (Email)**
- Email de confirmação de pedido
- Notificação quando pronto
- Relatórios para dono

**Vercel Blob (Imagens)**
- Upload de fotos de produtos
- CDN automático
- Versionamento

---

## Garantias Críticas (O Coração do Sistema)

### Atomicidade: Venda = Abate de Estoque

**Problema:**
\`\`\`
E se a venda for registrada mas o estoque não for abatido?
Cliente pagou, mas estoque ainda mostra produto disponível.
\`\`\`

**Solução:**
\`\`\`sql
BEGIN TRANSACTION;
  UPDATE inventory SET current_stock = current_stock - 5 WHERE id = X;
  INSERT INTO orders (...);
  INSERT INTO sales_transactions (...);
COMMIT; -- Tudo junto ou nada
\`\`\`

**Implementação:** Usar async/await com transação SQL.

### Race Condition: Múltiplas Vendas Simultâneas

**Problema:**
\`\`\`
Cliente A e Cliente B compram o último brigadeiro ao mesmo tempo.
\`\`\`

**Solução:**
\`\`\`sql
SELECT ... FROM inventory WHERE id = X FOR UPDATE;
-- Lock pessimista: bloqueia linha até liberar

1º cliente:  Compra 1 → Estoque 0 → Sucesso
2º cliente:  Aguarda lock
             Verifica estoque → 0 → FALHA
             ROLLBACK
\`\`\`

**Implementação:** `FOR UPDATE` no PostgreSQL.

### Auditoria Total

**Cada transação registra:**
- Quem vendeu (user_id)
- Quando (timestamp)
- O quê (product_id, quantity)
- Por quanto (valor)
- De qual canal (pdv/ecommerce/whatsapp)
- Hash para idempotência

**Tabela:** sales_transactions (e audit_log para alterações)

---

## Fluxo de Dados: Exemplo (Venda no PDV)

\`\`\`
1. Vendedor abre PDV
   └─> Next.js Page carrega
   └─> SWR busca /api/products (cache Redis)
   └─> Mostra lista de produtos

2. Vendedor busca "Brigadeiro"
   └─> Frontend filtra localmente (SWR)
   └─> Mostra 1 resultado: "Brigadeiro Gourmet"

3. Vendedor clica em produto + define quantidade (5)
   └─> Frontend valida contra inventory
   └─> Se ok: adiciona ao carrinho local

4. Vendedor clica "VENDER"
   └─> Frontend faz POST /api/sales
   └─> Backend inicia TRANSAÇÃO:
      a) FOR UPDATE inventory (lock)
      b) Verifica: SELECT estoque FROM inventory WHERE id = X
      c) Se 5 <= estoque:
         └─> UPDATE inventory SET estoque = estoque - 5
         └─> INSERT orders (status='ENTREGUE')
         └─> INSERT sales_transactions (...)
         └─> COMMIT
      d) Se falha:
         └─> ROLLBACK
         └─> Erro: "Apenas 3 disponíveis"

5. Frontend recebe resposta
   └─> Se sucesso: Mostra comprovante + invalida cache + limpa carrinho
   └─> Se falha: Mostra erro + mantém carrinho para ajustar
\`\`\`

---

## Escalabilidade

### Fase 1: Monolith (MVP)
- 1 servidor Vercel
- 1 database Supabase
- Suporta: 1 loja, 10 vendedores, 1000 produtos, 100 transações/dia

### Fase 2: Replicação Geo
- Múltiplos servidores Vercel (Edge)
- Supabase replicado regionalmente
- Suporta: 10 lojas, 100 vendedores, 100k transações/dia

### Fase 3: Microserviços
- Inventory Service separado (escala independentemente)
- Order Service separado
- Cache distribuído (Redis cluster)
- Suporta: 1000 lojas, 10k transações/dia

---

## Stack Tecnológico (Por Quê?)

| Componente | Escolha | Razão |
|-----------|---------|-------|
| Frontend | Next.js 15 (App Router) | Full-stack, SSR/SSG, rápido, Vercel native |
| Linguagem | TypeScript | Type-safe, melhor DX, menos erros |
| UI Framework | React 19 | Componentes reusáveis, amplo ecossistema |
| Styling | Tailwind CSS v4 | Utility-first, rápido, sem conflitos CSS |
| Database | PostgreSQL 15 (Supabase) | ACID forte, RLS built-in, transações confiáveis |
| Auth | Supabase Auth | JWT RS256, multi-provider ready, simple |
| Cache | Redis (Upstash) | Serverless, sem config, rápido |
| Pagamentos | Stripe | PCI compliance, webhook confiável, Brasil ready |
| WhatsApp | Twilio | API oficial, confiável, suporte |
| IA | OpenAI | GPT-4, conversas naturais, pricing bom |
| Email | Resend | Fácil, rápido, Brasil ready |
| Storage | Vercel Blob | CDN automático, integrado |
| Deploy | Vercel | Rápido, preview automático, GitHub sync |
