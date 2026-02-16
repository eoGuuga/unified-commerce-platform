> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# 03 - ARQUITETURA TÃ‰CNICA

## VisÃ£o Geral de 4 Camadas

\`\`\`
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ CAMADA 1: APRESENTAÃ‡ÃƒO (Frontend)                       â”‚
â”‚  - Next.js Pages (PDV, E-commerce, Admin Dashboard)    â”‚
â”‚  - React Components (reusÃ¡veis)                         â”‚
â”‚  - Tailwind CSS (styling)                               â”‚
â”‚  - SWR (data fetching & cache)                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                       â”‚ HTTP/HTTPS
                       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ CAMADA 2: API & APLICAÃ‡ÃƒO (Backend)                     â”‚
â”‚  - Next.js Route Handlers (/api/...)                   â”‚
â”‚  - Server Actions (forma RPC)                           â”‚
â”‚  - Business Logic (Inventory Manager, Order Manager)    â”‚
â”‚  - Transaction Handling (ACID)                          â”‚
â”‚  - Event Bus (notificaÃ§Ãµes em tempo real)              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                       â”‚ SQL
                       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ CAMADA 3: DADOS (Database + Cache)                      â”‚
â”‚  - PostgreSQL (Supabase): TransaÃ§Ãµes ACID               â”‚
â”‚  - Redis (Upstash): Cache de estoque & sessÃµes         â”‚
â”‚  - Row Level Security (RLS): Isolamento por loja       â”‚
â”‚  - Triggers & Constraints: Regras no banco              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                       â”‚ APIs
                       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ CAMADA 4: INTEGRAÃ‡Ã•ES (ServiÃ§os Terceiros)             â”‚
â”‚  - Stripe: Processamento de pagamentos                  â”‚
â”‚  - Twilio: WhatsApp Bot                                â”‚
â”‚  - OpenAI: IA conversacional                            â”‚
â”‚  - Resend: Email                                        â”‚
â”‚  - Vercel Blob: Storage de imagens                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
\`\`\`

## Componentes Principais

### Frontend (Camada 1)

**Interface PDV (Loja FÃ­sica)**
- Busca de produtos (autocomplete)
- Carrinho visual com estoque em tempo real
- Processamento de venda
- Comprovante gerado
- Modo offline (localStorage sync)
- **Tech:** Next.js App Router + React + Tailwind + SWR

**E-commerce (Storefront)**
- Homepage com catÃ¡logo
- PÃ¡gina de produto (fotos, descriÃ§Ã£o)
- Carrinho de compras
- Checkout de uma pÃ¡gina
- Rastreamento de pedido
- **Tech:** Next.js SSG/SSR + Server Components + Stripe

**Admin Dashboard**
- KPIs de hoje (vendas, pedidos, estoque)
- RelatÃ³rios de vendas (filtros, export)
- GestÃ£o de estoque
- Fila de produÃ§Ã£o (real-time)
- GestÃ£o de usuÃ¡rios
- **Tech:** Next.js Client Components + Recharts + SWR

### Backend (Camada 2)

**API de AutenticaÃ§Ã£o**
- Login/Logout (Supabase Auth)
- JWT token validation
- Session management
- **Endpoints:** POST /api/auth/login, /api/auth/logout

**API de Produtos**
- GET /api/products (listar)
- POST /api/products (criar) [admin only]
- PUT /api/products/:id (editar) [admin only]
- **Filtros:** Categoria, busca por nome, estoque

**API de Vendas (CrÃ­tica)**
- POST /api/sales (registrar venda)
- **Fluxo:**
  \`\`\`
  1. Validar entrada
  2. Iniciar TRANSAÃ‡ÃƒO
  3. FOR UPDATE na inventory (lock pessimista)
  4. Verificar estoque
  5. Abater estoque
  6. Criar pedido
  7. Registrar venda
  8. COMMIT ou ROLLBACK
  \`\`\`

**API de InventÃ¡rio**
- GET /api/inventory (verificar estoque)
- PUT /api/inventory/:id (repor)
- **Cache:** Redis com TTL de 1 segundo

**API de Ordens**
- GET /api/orders (listar)
- PUT /api/orders/:id (atualizar status)
- POST /api/orders (criar com suporte a cupons)
- **Realtime:** WebSocket para atualizaÃ§Ãµes
- âœ… **Sistema de Cupons** - Descontos percentuais e fixos integrados

**API de Cupons** âœ… **NOVO**
- GET /api/coupons (listar cupons)
- POST /api/coupons (criar cupom)
- GET /api/coupons/:code (validar cupom)
- **IntegraÃ§Ã£o:** AutomÃ¡tica em pedidos via `coupon_code`

**API de RelatÃ³rios**
- GET /api/reports/sales (vendas por perÃ­odo/canal)
- GET /api/reports/products (produtos mais vendidos)
- GET /api/reports/trends (trends semanais)

### Banco de Dados (Camada 3)

**PostgreSQL (Supabase)**
- Tabelas: users, products, inventory, orders, order_items, sales_transactions, payments, audit_log, cupons_desconto
- TransaÃ§Ãµes ACID garantem atomicidade
- Triggers para auditoria automÃ¡tica
- Ãndices para performance
- âœ… **RLS automÃ¡tico** via `TenantDbContextInterceptor`
- âœ… **TransaÃ§Ãµes compartilhadas** via `DbContextService`

**Redis (Upstash)**
- Cache de produtos: TTL 60s
- Cache de estoque: TTL 1s (muito curto para ser preciso)
- SessÃµes de carrinho: TTL 24h

**Row Level Security (RLS)**
- Cada usuÃ¡rio sÃ³ vÃª dados de sua loja
- PolÃ­ticas de seguranÃ§a no Supabase
- NÃ£o precisa checar store_id em cÃ³digo
- âœ… **TenantDbContextInterceptor** - Gerencia RLS automaticamente por request
- âœ… **DbContextService** - Compartilha transaÃ§Ãµes entre serviÃ§os

### IntegraÃ§Ãµes (Camada 4)

**Stripe (Pagamentos)**
- Payment Intent para checkout
- Webhook para confirmaÃ§Ã£o
- Nunca guardar dados de cartÃ£o (PCI compliance)

**Twilio (WhatsApp)**
- Receber mensagens (webhook)
- Enviar mensagens
- Webhook para confirmaÃ§Ã£o

**OpenAI (IA)**
- Processamento de linguagem natural
- Entender intenÃ§Ã£o do cliente
- Gerar respostas naturais

**Resend (Email)**
- Email de confirmaÃ§Ã£o de pedido
- NotificaÃ§Ã£o quando pronto
- RelatÃ³rios para dono

**Vercel Blob (Imagens)**
- Upload de fotos de produtos
- CDN automÃ¡tico
- Versionamento

---

## Garantias CrÃ­ticas (O CoraÃ§Ã£o do Sistema)

### Atomicidade: Venda = Abate de Estoque

**Problema:**
\`\`\`
E se a venda for registrada mas o estoque nÃ£o for abatido?
Cliente pagou, mas estoque ainda mostra produto disponÃ­vel.
\`\`\`

**SoluÃ§Ã£o:**
\`\`\`sql
BEGIN TRANSACTION;
  UPDATE inventory SET current_stock = current_stock - 5 WHERE id = X;
  INSERT INTO orders (...);
  INSERT INTO sales_transactions (...);
COMMIT; -- Tudo junto ou nada
\`\`\`

**ImplementaÃ§Ã£o:** Usar async/await com transaÃ§Ã£o SQL.

### Race Condition: MÃºltiplas Vendas SimultÃ¢neas

**Problema:**
\`\`\`
Cliente A e Cliente B compram o Ãºltimo brigadeiro ao mesmo tempo.
\`\`\`

**SoluÃ§Ã£o:**
\`\`\`sql
SELECT ... FROM inventory WHERE id = X FOR UPDATE;
-- Lock pessimista: bloqueia linha atÃ© liberar

1Âº cliente:  Compra 1 â†’ Estoque 0 â†’ Sucesso
2Âº cliente:  Aguarda lock
             Verifica estoque â†’ 0 â†’ FALHA
             ROLLBACK
\`\`\`

**ImplementaÃ§Ã£o:** `FOR UPDATE` no PostgreSQL.

### Auditoria Total

**Cada transaÃ§Ã£o registra:**
- Quem vendeu (user_id)
- Quando (timestamp)
- O quÃª (product_id, quantity)
- Por quanto (valor)
- De qual canal (pdv/ecommerce/whatsapp)
- Hash para idempotÃªncia

**Tabela:** sales_transactions (e audit_log para alteraÃ§Ãµes)

---

## Fluxo de Dados: Exemplo (Venda no PDV)

\`\`\`
1. Vendedor abre PDV
   â””â”€> Next.js Page carrega
   â””â”€> SWR busca /api/products (cache Redis)
   â””â”€> Mostra lista de produtos

2. Vendedor busca "Brigadeiro"
   â””â”€> Frontend filtra localmente (SWR)
   â””â”€> Mostra 1 resultado: "Brigadeiro Gourmet"

3. Vendedor clica em produto + define quantidade (5)
   â””â”€> Frontend valida contra inventory
   â””â”€> Se ok: adiciona ao carrinho local

4. Vendedor clica "VENDER"
   â””â”€> Frontend faz POST /api/sales
   â””â”€> Backend inicia TRANSAÃ‡ÃƒO:
      a) FOR UPDATE inventory (lock)
      b) Verifica: SELECT estoque FROM inventory WHERE id = X
      c) Se 5 <= estoque:
         â””â”€> UPDATE inventory SET estoque = estoque - 5
         â””â”€> INSERT orders (status='ENTREGUE')
         â””â”€> INSERT sales_transactions (...)
         â””â”€> COMMIT
      d) Se falha:
         â””â”€> ROLLBACK
         â””â”€> Erro: "Apenas 3 disponÃ­veis"

5. Frontend recebe resposta
   â””â”€> Se sucesso: Mostra comprovante + invalida cache + limpa carrinho
   â””â”€> Se falha: Mostra erro + mantÃ©m carrinho para ajustar
\`\`\`

---

## Escalabilidade

### Fase 1: Monolith (MVP)
- 1 servidor Vercel
- 1 database Supabase
- Suporta: 1 loja, 10 vendedores, 1000 produtos, 100 transaÃ§Ãµes/dia

### Fase 2: ReplicaÃ§Ã£o Geo
- MÃºltiplos servidores Vercel (Edge)
- Supabase replicado regionalmente
- Suporta: 10 lojas, 100 vendedores, 100k transaÃ§Ãµes/dia

### Fase 3: MicroserviÃ§os
- Inventory Service separado (escala independentemente)
- Order Service separado
- Cache distribuÃ­do (Redis cluster)
- Suporta: 1000 lojas, 10k transaÃ§Ãµes/dia

---

## Stack TecnolÃ³gico (Por QuÃª?)

| Componente | Escolha | RazÃ£o |
|-----------|---------|-------|
| Frontend | Next.js 15 (App Router) | Full-stack, SSR/SSG, rÃ¡pido, Vercel native |
| Linguagem | TypeScript | Type-safe, melhor DX, menos erros |
| UI Framework | React 19 | Componentes reusÃ¡veis, amplo ecossistema |
| Styling | Tailwind CSS v4 | Utility-first, rÃ¡pido, sem conflitos CSS |
| Database | PostgreSQL 15 (Supabase) | ACID forte, RLS built-in, transaÃ§Ãµes confiÃ¡veis |
| Auth | Supabase Auth | JWT RS256, multi-provider ready, simple |
| Cache | Redis (Upstash) | Serverless, sem config, rÃ¡pido |
| Pagamentos | Stripe | PCI compliance, webhook confiÃ¡vel, Brasil ready |
| WhatsApp | Twilio | API oficial, confiÃ¡vel, suporte |
| IA | OpenAI | GPT-4, conversas naturais, pricing bom |
| Email | Resend | FÃ¡cil, rÃ¡pido, Brasil ready |
| Storage | Vercel Blob | CDN automÃ¡tico, integrado |
| Deploy | Vercel | RÃ¡pido, preview automÃ¡tico, GitHub sync |

