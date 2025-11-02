# 02 - ARQUITETURA TÉCNICA

## Visão Geral da Arquitetura

\`\`\`
┌────────────────────────────────────────────────────────────────┐
│                        CLIENTE                                  │
│  (Browser, Mobile, WhatsApp)                                   │
└────────────────────────────────────┬─────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
        ┌───────────▼──────┐  ┌──────▼────────┐  ┌──▼─────────┐
        │   PDV Interface  │  │ E-commerce    │  │ WhatsApp   │
        │   (Next.js Page) │  │ (Next.js Page)│  │ Bot Webhook│
        └──────────┬───────┘  └───────┬────────┘  └────┬──────┘
                   │                  │                 │
                   └──────────────────┼─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │    API Layer (Route Handlers)     │
                    │  - /api/products                  │
                    │  - /api/orders                    │
                    │  - /api/sales                     │
                    │  - /api/inventory                 │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │    Business Logic Layer           │
                    │  (Server Actions + Utils)         │
                    │  - Inventory Manager              │
                    │  - Order Manager                  │
                    │  - Transaction Handler            │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │    Data Layer (Database)          │
                    │  - Supabase/PostgreSQL            │
                    │  - Tables: Products, Orders, etc  │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │  External Services                │
                    │  - Stripe (Payments)              │
                    │  - Twilio (WhatsApp)              │
                    │  - Vercel Blob (Images)           │
                    │  - Upstash Redis (Cache)          │
                    └─────────────────────────────────────┘
\`\`\`

---

## Componentes Principais

### 1. Frontend Layer

#### PDV Interface
- **Stack:** Next.js App Router + React + Tailwind
- **Responsabilidade:** 
  - Permitir vendedor registrar venda rápida
  - Buscar produto por nome/código
  - Calcular total
  - Processar pagamento
- **Requisitos:**
  - Funcionar em tablet (responsivo)
  - Modo offline (sincroniza depois)
  - Atalhos para produtos populares

#### E-commerce (Storefront)
- **Stack:** Next.js App Router + React + Tailwind
- **Responsabilidade:**
  - Exibir catálogo de produtos
  - Carrinho de compras
  - Checkout
  - Confirmação de pedido
- **Requisitos:**
  - SEO otimizado (Server Components)
  - Rápido carregamento
  - Mobile friendly
  - Foto dos produtos

#### WhatsApp Bot Integration
- **Stack:** Next.js Route Handler (webhook)
- **Responsabilidade:**
  - Receber mensagens via Twilio
  - Processar texto com IA
  - Registrar pedidos
  - Enviar confirmações
- **Requisitos:**
  - Resposta em < 3 segundos
  - Fallback para atendimento humano
  - Log de conversas

### 2. API Layer (Route Handlers)

#### /api/products
- **GET** → Listar produtos com estoque
- **POST** → Criar novo produto (admin)
- **PUT** → Atualizar produto

#### /api/inventory
- **GET** → Verificar estoque
- **POST** → Atualizar estoque (transação atômica)
- **DELETE** → Abater estoque (venda)

#### /api/orders
- **GET** → Listar pedidos (filtro por status/data)
- **POST** → Criar novo pedido
- **PUT** → Atualizar status do pedido

#### /api/sales
- **GET** → Listar vendas (relatórios)
- **POST** → Registrar venda (PDV/E-commerce)

#### /api/payments
- **POST** → Processar pagamento (Stripe)
- **POST** → Webhook de confirmação Stripe

#### /api/whatsapp
- **POST** → Webhook do Twilio (receber mensagens)

### 3. Business Logic Layer

#### Inventory Manager
\`\`\`
Responsabilidade: Garantir consistência de estoque

Operações Críticas:
1. Verificar estoque disponível
2. Abater item (venda confirmada)
3. Reabrir venda (cancelamento)
4. Sincronizar com múltiplos canais

Implementação:
- Usar transações SQL (ACID)
- Lock pessimista para evitar race conditions
- Auditoria de cada operação
\`\`\`

#### Order Manager
\`\`\`
Responsabilidade: Gerenciar fila de produção

Operações:
1. Criar pedido quando venda é confirmada
2. Atualizar status (pendente → em produção → pronto)
3. Notificar cliente quando pronto
4. Registrar data de entrega

Fluxo de Status:
PENDENTE → CONFIRMADO → EM_PRODUCAO → PRONTO → ENTREGUE
\`\`\`

#### Transaction Handler
\`\`\`
Responsabilidade: Registrar cada transação para auditoria

Registra:
- Quem vendeu (user_id)
- Qual canal (PDV/E-commerce/WhatsApp)
- Produtos envolvidos
- Valor total
- Data/hora
- Status
\`\`\`

### 4. Data Layer (Supabase)

Ver **[04-DATABASE.md](docs/04-DATABASE.md)** para schema completo.

**Tabelas Principais:**
- `products` - Catálogo
- `inventory` - Estoque (VIEW)
- `orders` - Pedidos
- `sales_transactions` - Histórico de vendas
- `users` - Vendedores e admin
- `payments` - Histórico de pagamentos

### 5. External Services

#### Stripe (Pagamentos)
- Processamento de cartão de crédito
- Webhooks para confirmação
- Nunca guardar dados de cartão

#### Twilio (WhatsApp)
- Enviar/receber mensagens
- Webhook para integração
- Rate limiting

#### Vercel Blob (Imagens)
- Storage de fotos de produtos
- CDN automático
- Versionamento

#### Upstash Redis (Cache)
- Cache de produtos populares
- Cache de estoque (TTL 1 segundo)
- Sessões de carrinho

---

## Fluxo de Dados: Uma Venda

### Cenário 1: Venda no PDV

\`\`\`
1. Vendedor abre PDV
   └─> Carrega lista de produtos (cache Redis)

2. Vendedor busca "Brigadeiro"
   └─> Backend: SELECT * FROM products WHERE name LIKE '%brigadeiro%'

3. Vendedor seleciona "Brigadeiro Gourmet" (quantidade: 5)
   └─> Frontend valida quantidade contra inventory

4. Vendedor clica "VENDER"
   └─> Backend inicia TRANSAÇÃO:
      a) Verifica estoque: SELECT estoque FROM inventory WHERE product_id = X FOR UPDATE
      b) Se tem quantidade: UPDATE inventory SET estoque = estoque - 5
      c) Cria pedido: INSERT INTO orders (product_id, qty, status) VALUES (X, 5, 'ENTREGUE')
      d) Cria transação: INSERT INTO sales_transactions (...)
      e) COMMIT (tudo ou nada)

5. Se sucesso:
   └─> Retorna comprovante ao vendedor
   └─> Estoque atualizado em tempo real
   └─> Relatório updatado

6. Se falha (sem estoque):
   └─> Mostra mensagem de erro
   └─> Transação não é confirmada
\`\`\`

### Cenário 2: Venda no E-commerce

\`\`\`
1. Cliente abre site
   └─> Next.js renderiza produtos (Server Component)
   └─> Carrega estoque ATUAL

2. Cliente adiciona "Brigadeiro" ao carrinho
   └─> Frontend cache local (SWR)

3. Cliente vai para checkout
   └─> Valida estoque novamente (pode ter mudado)

4. Cliente paga com Stripe
   └─> Stripe processa pagamento
   └─> Webhook retorna confirmação

5. Backend confirma pagamento:
   └─> Inicia TRANSAÇÃO (igual ao PDV):
      a) Verifica estoque
      b) Abate estoque
      c) Cria pedido
      d) Cria transação
      e) COMMIT

6. Se sucesso:
   └─> Envia email de confirmação
   └─> Cria link de acompanhamento

7. Se falha:
   └─> Retorna crédito para cliente
   └─> Notifica admin
\`\`\`

### Cenário 3: Venda via WhatsApp Bot

\`\`\`
1. Cliente envia mensagem no WhatsApp
   └─> Twilio webhook recebe

2. Backend processa com IA:
   └─> "Quero 3 brigadeiros"
   └─> IA entende: produto_id=5, qty=3

3. Backend valida estoque:
   └─> Verifica se tem 3 brigadeiros

4. Se tem:
   └─> Bot responde: "Perfeito! 3 brigadeiros = R$ 30. Como prefere pagar?"

5. Cliente responde: "Pix"
   └─> Bot gera QR code Pix
   └─> Aguarda confirmação de pagamento

6. Quando pagamento é confirmado:
   └─> Inicia TRANSAÇÃO (igual PDV/E-commerce)
   └─> Cria pedido
   └─> Envia link de acompanhamento

7. Se não tem estoque:
   └─> Bot responde: "Desculpa, o brigadeiro acabou. Temos Brigadeiro de Chocolate?"
\`\`\`

---

## Garantias Críticas

### 1. Atomicidade (Venda = Abate de Estoque)
**Problema:** E se a venda for registrada mas o estoque não for abatido?

**Solução:**
\`\`\`
TRANSAÇÃO {
  - Abate estoque (UPDATE inventory)
  - Cria pedido (INSERT orders)
  - Registra venda (INSERT sales_transactions)
  - COMMIT tudo junto
  - Se falhar em qualquer etapa: ROLLBACK
}
\`\`\`

**Implementação:** Usar `async/await` com transação SQL.

### 2. Race Condition (Múltiplas vendas simultâneas)
**Problema:** Dois clientes compram o último brigadeiro ao mesmo tempo.

**Solução:**
\`\`\`
SELECT ... FROM inventory ... FOR UPDATE
└─> Lock pessimista: bloqueia linha até liberar

1º cliente:  Compra 1 → Estoque 0 → Sucesso
2º cliente:  Aguarda lock
             Verifica estoque → 0 → FALHA
             Rollback
\`\`\`

### 3. Overselling Prevention
**Regra:** Nunca pode vender mais do que existe.

**Implementação:**
\`\`\`
BEFORE INSERT/UPDATE on inventory:
  IF novo_estoque < 0 THEN
    RAISE ERROR "Sem estoque"
  END IF
\`\`\`

### 4. Auditoria Total
**Cada transação registra:**
- Quem vendeu (user_id)
- Quando (timestamp)
- O quê (products)
- Por quanto (valor)
- De qual canal (PDV/E-commerce/WhatsApp)

---

## Escalabilidade

### Fase 1: Monolith (MVP)
- Um servidor Vercel
- Um banco Supabase
- Suficiente para: 1 loja, 10 vendedores, 1000 produtos

### Fase 2: Replicação Geo
- Múltiplos servidores Vercel (Edge)
- Replicação Supabase regional
- Suficiente para: 10 lojas, 100 vendedores

### Fase 3: Microserviços
- Inventory Service separado
- Order Service separado
- Cache distribuído (Redis)
- Suficiente para: 1000 lojas

---

## Tecnologias: Por Quê?

| Tech | Razão |
|------|-------|
| **Next.js** | Full-stack, SSR/SSG, Vercel native |
| **Supabase** | PostgreSQL gerenciado, Auth, RLS |
| **Stripe** | Pagamentos, PCI compliance |
| **Twilio** | WhatsApp API oficial, confiável |
| **Vercel Blob** | CDN de imagens, integrada |
| **Upstash Redis** | Cache serverless, sem configuração |
