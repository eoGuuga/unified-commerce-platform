# 04 - BANCO DE DADOS

## Schema Overview

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                        SUPABASE                         │
│                    (PostgreSQL)                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [USERS]          [PRODUCTS]       [INVENTORY]          │
│    ↓                ↓                 ↓                 │
│    └────────→ [SALES_TRANSACTIONS]                      │
│                     ↓                                    │
│                 [ORDERS]                                │
│                     ↓                                    │
│                [ORDER_ITEMS]                            │
│                                                          │
│  [PAYMENTS]  [DELIVERY_ROUTES]  [AUDIT_LOG]            │
│                                                          │
└─────────────────────────────────────────────────────────┘
\`\`\`

---

## Tabelas Principais

### 1. USERS
Usuários da plataforma (vendedores, admin, etc).

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL, -- 'admin' | 'manager' | 'seller' | 'support'
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'inactive' | 'suspended'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

**Índices:**
\`\`\`sql
CREATE INDEX idx_users_store_id ON users(store_id);
CREATE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_store_email ON users(store_id, email);
\`\`\`

### 2. PRODUCTS
Catálogo de produtos.

\`\`\`sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500),
  category VARCHAR(100),
  sku VARCHAR(100) UNIQUE,
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'inactive' | 'discontinued'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

**Índices:**
\`\`\`sql
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
\`\`\`

### 3. INVENTORY
Estoque (VIEW + Trigger para sincronização).

\`\`\`sql
-- Primeira vez: Inicializar com 0 para cada produto
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  current_stock INT NOT NULL DEFAULT 0,
  reserved_stock INT DEFAULT 0, -- Vendas pendentes de confirmar
  minimum_threshold INT DEFAULT 10,
  last_updated TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
\`\`\`

**Índices:**
\`\`\`sql
CREATE INDEX idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX idx_inventory_current_stock ON inventory(current_stock);
\`\`\`

**Trigger:** Atualizar `last_updated` ao abater estoque.

### 4. ORDERS (Fila de Produção)
Pedidos aguardando produção/entrega.

\`\`\`sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', 
  -- 'pending' | 'confirmed' | 'in_production' | 'ready' | 'delivered' | 'cancelled'
  delivery_type VARCHAR(50), -- 'pickup' | 'delivery' | 'immediate'
  delivery_address TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
\`\`\`

**Índices:**
\`\`\`sql
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
\`\`\`

### 5. ORDER_ITEMS
Produtos dentro de um pedido.

\`\`\`sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL -- quantity * unit_price
);
\`\`\`

**Índices:**
\`\`\`sql
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
\`\`\`

### 6. SALES_TRANSACTIONS
Auditoria de todas as vendas.

\`\`\`sql
CREATE TABLE sales_transactions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  order_id UUID REFERENCES orders(id),
  seller_id UUID REFERENCES users(id),
  channel VARCHAR(50) NOT NULL, -- 'pdv' | 'ecommerce' | 'whatsapp'
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash' | 'card' | 'pix' | 'ticket'
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'failed'
  products_sold TEXT, -- JSON array: [{"product_id": "...", "qty": 5}, ...]
  transaction_hash VARCHAR(255) UNIQUE, -- Para idempotência
  created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

**Índices:**
\`\`\`sql
CREATE INDEX idx_sales_store_id ON sales_transactions(store_id);
CREATE INDEX idx_sales_channel ON sales_transactions(channel);
CREATE INDEX idx_sales_created_at ON sales_transactions(created_at DESC);
CREATE INDEX idx_sales_payment_status ON sales_transactions(payment_status);
\`\`\`

### 7. PAYMENTS
Histórico de pagamentos (integração Stripe).

\`\`\`sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  order_id UUID REFERENCES orders(id),
  transaction_id UUID REFERENCES sales_transactions(id),
  stripe_payment_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'succeeded' | 'failed' | 'cancelled'
  method VARCHAR(50), -- 'card' | 'pix' | 'boleto'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

---

## Fluxo Crítico: Atomicidade de Venda

### Problema
Duas vendas simultâneas do último brigadeiro.

### Solução

\`\`\`sql
-- VENDA 1 (PDV): Compra 1 brigadeiro
BEGIN TRANSACTION;

-- Lock pessimista: Bloqueia a linha de inventário
SELECT current_stock 
FROM inventory 
WHERE product_id = 'prod-123' 
  AND store_id = 'store-456'
FOR UPDATE;
-- Agora apenas essa transação pode modificar

-- Verifica estoque
-- current_stock = 1 ✓

-- Abate
UPDATE inventory 
SET current_stock = current_stock - 1
WHERE product_id = 'prod-123' AND store_id = 'store-456';

-- Cria pedido
INSERT INTO orders (...) VALUES (...);
ORDER_ID = 'ORD-789'

-- Registra venda
INSERT INTO sales_transactions (order_id, ...) VALUES ('ORD-789', ...);

COMMIT;
-- Lock liberado


-- VENDA 2 (E-commerce): Tentando comprar 1 brigadeiro
BEGIN TRANSACTION;

-- Aguarda lock da VENDA 1
SELECT current_stock 
FROM inventory 
WHERE product_id = 'prod-123' 
  AND store_id = 'store-456'
FOR UPDATE;
-- Agora tem lock

-- Verifica estoque
-- current_stock = 0 ✗ SEM ESTOQUE

-- Levanta erro
ROLLBACK;
-- Transação inteira cancelada
\`\`\`

### Implementação em Node.js

\`\`\`js
async function processSale(storeId, productId, quantity) {
  try {
    // Começar transação
    const result = await db.transaction(async (trx) => {
      // Lock pessimista
      const [inventory] = await trx('inventory')
        .where({ product_id: productId, store_id: storeId })
        .forUpdate();
      
      if (!inventory) throw new Error('Produto não existe');
      if (inventory.current_stock < quantity) {
        throw new Error('Estoque insuficiente');
      }
      
      // Abater
      await trx('inventory')
        .where({ product_id: productId, store_id: storeId })
        .decrement('current_stock', quantity);
      
      // Criar pedido
      const [order] = await trx('orders').insert({
        store_id: storeId,
        order_number: `ORD-${Date.now()}`,
        status: 'immediate', // PDV = entrega imediata
        total_amount: price * quantity
      });
      
      // Registrar venda
      await trx('sales_transactions').insert({
        order_id: order.id,
        store_id: storeId,
        channel: 'pdv',
        total_amount: price * quantity,
        products_sold: JSON.stringify([{
          product_id: productId,
          quantity
        }])
      });
      
      return order;
    });
    
    return result;
  } catch (error) {
    // ROLLBACK automático se erro
    throw error;
  }
}
\`\`\`

---

## Relatórios (Views)

### View: Vendas por Canal (Últimos 30 dias)

\`\`\`sql
CREATE VIEW sales_by_channel_30d AS
SELECT 
  channel,
  COUNT(*) as num_transactions,
  SUM(total_amount) as total_revenue,
  AVG(total_amount) as avg_ticket
FROM sales_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY channel
ORDER BY total_revenue DESC;
\`\`\`

### View: Produtos Mais Vendidos

\`\`\`sql
CREATE VIEW top_products AS
SELECT 
  p.id,
  p.name,
  SUM(oi.quantity) as total_qty_sold,
  SUM(oi.subtotal) as total_revenue
FROM products p
JOIN order_items oi ON p.id = oi.product_id
JOIN orders o ON oi.order_id = o.id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name
ORDER BY total_qty_sold DESC;
\`\`\`

---

## Row Level Security (RLS)

### Princípio
Cada loja só acessa seus próprios dados.

\`\`\`sql
-- Habilitar RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Vendedor só vê produtos da sua loja
CREATE POLICY "users_see_own_store_products" ON products
  FOR SELECT
  USING (store_id = (SELECT store_id FROM users WHERE id = auth.uid()));

-- Policy: Usuários só veem seus próprios dados
CREATE POLICY "users_see_own_store_sales" ON sales_transactions
  FOR SELECT
  USING (store_id = (SELECT store_id FROM users WHERE id = auth.uid()));
\`\`\`

---

## Backups e Disaster Recovery

\`\`\`
Daily Backups:
├─ 00:00 - Backup completo (Supabase)
├─ 06:00 - Backup incremental
├─ 12:00 - Backup incremental
└─ 18:00 - Backup incremental

Retenção: 30 dias

Teste de Restore: 1x por semana (automático)

Objetivo de Recuperação (RTO): 1 hora
Objetivo de Ponto de Recuperação (RPO): 5 minutos
