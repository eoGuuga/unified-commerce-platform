# 04 - DATABASE SCHEMA

## Visão Geral

\`\`\`
┌──────────────┐
│    USERS     │ (Vendedores, Admin, etc)
├──────────────┤
│ id (UUID)    │
│ store_id (FK)│◄──────┐
│ email        │       │
│ role         │       │
│ created_at   │       │
└──────────────┘       │
                       │
┌──────────────┐       │
│   STORES     │       │
├──────────────┤       │
│ id (UUID)────┼───────┘
│ name         │
│ owner_id (FK)│
└──────────────┘
      ▲
      │
      ├─────────────────────────────┬────────────────────┐
      │                             │                    │
┌─────┴────────┐  ┌─────────────┐  │  ┌─────────────┐   │
│  PRODUCTS    │  │ INVENTORY   │  │  │   ORDERS    │   │
├──────────────┤  ├─────────────┤  │  ├─────────────┤   │
│ id (UUID)    │  │ id (UUID)   │  │  │ id (UUID)   │   │
│ store_id (FK)│  │ store_id (FK)  │  │ store_id (FK)  │
│ name         │  │ product_id (FK)─┘  │ order_no    │   │
│ price        │  │ current_stock  │   │ status      │   │
│ category     │  │ reserved_stock │   │ total_amount│   │
└──────────────┘  │ last_updated   │   │ created_at  │   │
                  └────────────────┘   └─────────────┘   │
                                              │           │
                                    ┌─────────▼────────┐ │
                                    │  ORDER_ITEMS     │ │
                                    ├──────────────────┤ │
                                    │ id (UUID)        │ │
                                    │ order_id (FK)────┤─┘
                                    │ product_id (FK)  │
                                    │ quantity         │
                                    │ unit_price       │
                                    │ subtotal         │
                                    └──────────────────┘

┌─────────────────────────┐  ┌──────────────────────┐
│ SALES_TRANSACTIONS      │  │ PAYMENTS             │
├─────────────────────────┤  ├──────────────────────┤
│ id (UUID)               │  │ id (UUID)            │
│ store_id (FK)           │  │ store_id (FK)        │
│ order_id (FK, nullable) │  │ order_id (FK)        │
│ seller_id (FK)          │  │ transaction_id (FK)  │
│ channel                 │  │ stripe_payment_id    │
│ total_amount            │  │ amount               │
│ payment_method          │  │ status               │
│ products_sold (JSON)    │  │ created_at           │
│ transaction_hash        │  └──────────────────────┘
│ created_at              │
└─────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│ AUDIT_LOG            │  │ DELIVERY_ROUTES      │
├──────────────────────┤  ├──────────────────────┤
│ id (UUID)            │  │ id (UUID)            │
│ store_id (FK)        │  │ store_id (FK)        │
│ user_id (FK)         │  │ order_id (FK)        │
│ action               │  │ route                │
│ table_name           │  │ status               │
│ record_id            │  │ delivered_at         │
│ old_data (JSONB)     │  └──────────────────────┘
│ new_data (JSONB)     │
│ created_at           │
└──────────────────────┘
\`\`\`

---

## Transação Crítica de Venda (Pseudocódigo)

### Pseudocódigo Executável

\`\`\`javascript
async function processSale(storeId, items, channel, sellerId) {
  // items = [{productId, quantity}, ...]
  
  const result = await db.transaction(async (trx) => {
    // 1. Lock pessimista: FOR UPDATE
    const inventories = await trx('inventory')
      .whereIn('product_id', items.map(i => i.productId))
      .andWhere('store_id', storeId)
      .forUpdate(); // ← Lock: apenas essa transação pode editar

    // 2. Validar estoque
    for (const item of items) {
      const inv = inventories.find(i => i.product_id === item.productId);
      if (!inv || inv.current_stock < item.quantity) {
        throw new Error(`Estoque insuficiente: ${item.productId}`);
      }
    }

    // 3. Abater estoque
    for (const item of items) {
      await trx('inventory')
        .where('product_id', item.productId)
        .andWhere('store_id', storeId)
        .decrement('current_stock', item.quantity);
    }

    // 4. Criar pedido
    const [orderId] = await trx('orders').insert({
      store_id: storeId,
      order_number: `ORD-${Date.now()}`,
      status: channel === 'pdv' ? 'ENTREGUE' : 'CONFIRMADO',
      total_amount: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      seller_id: sellerId,
      created_at: new Date()
    });

    // 5. Criar itens do pedido
    for (const item of items) {
      await trx('order_items').insert({
        order_id: orderId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity
      });
    }

    // 6. Registrar transação (auditoria)
    const txHash = crypto
      .createHash('sha256')
      .update(`${orderId}${Date.now()}`)
      .digest('hex');

    await trx('sales_transactions').insert({
      store_id: storeId,
      order_id: orderId,
      seller_id: sellerId,
      channel,
      total_amount: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      products_sold: JSON.stringify(items),
      transaction_hash: txHash,
      created_at: new Date()
    });

    return orderId;
    // Se tudo ok: COMMIT
    // Se erro: ROLLBACK automático
  });

  // 7. Invalidar cache Redis
  await cache.del(`inventory:${storeId}:*`);

  return result;
}
\`\`\`

### O Que Garante This

**Atomicidade:** Se qualquer etapa falhar (ex: estoque insuficiente na etapa 2), ROLLBACK é automático.

**Idempotência:** Se requisição é enviada 2x (problema de rede), transaction_hash garante que não duplica.

**Auditoria:** Cada venda é registrada com exatidão.

---

## Índices para Performance

\`\`\`sql
-- Searches rápidas
CREATE INDEX idx_products_store_name ON products(store_id, name);
CREATE INDEX idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_sales_store_created ON sales_transactions(store_id, created_at DESC);

-- Para relatórios
CREATE INDEX idx_orders_created_at ON orders(store_id, created_at DESC);
CREATE INDEX idx_sales_channel ON sales_transactions(store_id, channel);
\`\`\`

---

## Row Level Security (RLS)

### Princípio

Cada loja só acessa seus dados. Mesmo se alguém roubar token, não acessa outra loja.

### Implementação

\`\`\`sql
-- Ativar RLS em todas tabelas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Usuário só vê produtos da sua loja
CREATE POLICY "users_see_own_store_products" ON products
  FOR SELECT
  USING (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  );

-- Policy: Usuário só pode criar pedido na sua loja
CREATE POLICY "users_create_own_store_orders" ON orders
  FOR INSERT
  WITH CHECK (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  );

-- Policy: Usuário só pode editar pedido da sua loja
CREATE POLICY "users_update_own_store_orders" ON orders
  FOR UPDATE
  USING (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  );
\`\`\`

### Benefícios

- ✓ Segurança no banco (não depende de código)
- ✓ Escalável (funciona com 1 ou 10000 lojas)
- ✓ Sem duplicação de lógica

---

## Triggers para Auditoria

\`\`\`sql
-- Atualizar timestamp ao mudar
CREATE TRIGGER update_inventory_timestamp
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Registrar mudanças em audit_log
CREATE TRIGGER audit_inventory_changes
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_changes('inventory');
\`\`\`

---

## Backups & Disaster Recovery

**Automático via Supabase:**
- Daily backups (completo)
- Retenção: 30 dias
- Teste de restore: 1x/semana

**SLO:**
- RTO (Recovery Time Objective): 1 hora
- RPO (Recovery Point Objective): 5 minutos
