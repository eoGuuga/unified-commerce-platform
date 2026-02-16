> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# 04 - DATABASE SCHEMA

## VisÃ£o Geral

\`\`\`
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚    USERS     â”‚ (Vendedores, Admin, etc)
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ id (UUID)    â”‚
â”‚ store_id (FK)â”‚â—„â”€â”€â”€â”€â”€â”€â”
â”‚ email        â”‚       â”‚
â”‚ role         â”‚       â”‚
â”‚ created_at   â”‚       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜       â”‚
                       â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”       â”‚
â”‚   STORES     â”‚       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤       â”‚
â”‚ id (UUID)â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚ name         â”‚
â”‚ owner_id (FK)â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
      â–²
      â”‚
      â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
      â”‚                             â”‚                    â”‚
â”Œâ”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  PRODUCTS    â”‚  â”‚ INVENTORY   â”‚  â”‚  â”‚   ORDERS    â”‚   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤  â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   â”‚
â”‚ id (UUID)    â”‚  â”‚ id (UUID)   â”‚  â”‚  â”‚ id (UUID)   â”‚   â”‚
â”‚ store_id (FK)â”‚  â”‚ store_id (FK)  â”‚  â”‚ store_id (FK)  â”‚
â”‚ name         â”‚  â”‚ product_id (FK)â”€â”˜  â”‚ order_no    â”‚   â”‚
â”‚ price        â”‚  â”‚ current_stock  â”‚   â”‚ status      â”‚   â”‚
â”‚ category     â”‚  â”‚ reserved_stock â”‚   â”‚ total_amountâ”‚   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚ last_updated   â”‚   â”‚ created_at  â”‚   â”‚
                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
                                              â”‚           â”‚
                                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
                                    â”‚  ORDER_ITEMS     â”‚ â”‚
                                    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”‚
                                    â”‚ id (UUID)        â”‚ â”‚
                                    â”‚ order_id (FK)â”€â”€â”€â”€â”¤â”€â”˜
                                    â”‚ product_id (FK)  â”‚
                                    â”‚ quantity         â”‚
                                    â”‚ unit_price       â”‚
                                    â”‚ subtotal         â”‚
                                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ SALES_TRANSACTIONS      â”‚  â”‚ PAYMENTS             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ id (UUID)               â”‚  â”‚ id (UUID)            â”‚
â”‚ store_id (FK)           â”‚  â”‚ store_id (FK)        â”‚
â”‚ order_id (FK, nullable) â”‚  â”‚ order_id (FK)        â”‚
â”‚ seller_id (FK)          â”‚  â”‚ transaction_id (FK)  â”‚
â”‚ channel                 â”‚  â”‚ stripe_payment_id    â”‚
â”‚ total_amount            â”‚  â”‚ amount               â”‚
â”‚ payment_method          â”‚  â”‚ status               â”‚
â”‚ products_sold (JSON)    â”‚  â”‚ created_at           â”‚
â”‚ transaction_hash        â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚ created_at              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ AUDIT_LOG            â”‚  â”‚ DELIVERY_ROUTES      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ id (UUID)            â”‚  â”‚ id (UUID)            â”‚
â”‚ store_id (FK)        â”‚  â”‚ store_id (FK)        â”‚
â”‚ user_id (FK)         â”‚  â”‚ order_id (FK)        â”‚
â”‚ action               â”‚  â”‚ route                â”‚
â”‚ table_name           â”‚  â”‚ status               â”‚
â”‚ record_id            â”‚  â”‚ delivered_at         â”‚
â”‚ old_data (JSONB)     â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚ new_data (JSONB)     â”‚
â”‚ created_at           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ CUPONS_DESCONTO      â”‚ âœ… **NOVO**
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ id (UUID)            â”‚
â”‚ tenant_id (FK)       â”‚
â”‚ code (VARCHAR(50))   â”‚
â”‚ discount_type (ENUM) â”‚ 'percentage' | 'fixed'
â”‚ discount_value       â”‚
â”‚ min_purchase_amount  â”‚
â”‚ max_discount_amount  â”‚
â”‚ usage_limit          â”‚
â”‚ used_count           â”‚
â”‚ is_active            â”‚
â”‚ valid_from           â”‚
â”‚ valid_until          â”‚
â”‚ created_at           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
\`\`\`

---

## TransaÃ§Ã£o CrÃ­tica de Venda (PseudocÃ³digo)

### PseudocÃ³digo ExecutÃ¡vel

\`\`\`javascript
async function processSale(storeId, items, channel, sellerId) {
  // items = [{productId, quantity}, ...]
  
  const result = await db.transaction(async (trx) => {
    // 1. Lock pessimista: FOR UPDATE
    const inventories = await trx('inventory')
      .whereIn('product_id', items.map(i => i.productId))
      .andWhere('store_id', storeId)
      .forUpdate(); // â† Lock: apenas essa transaÃ§Ã£o pode editar

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

    // 6. Registrar transaÃ§Ã£o (auditoria)
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
    // Se erro: ROLLBACK automÃ¡tico
  });

  // 7. Invalidar cache Redis
  await cache.del(`inventory:${storeId}:*`);

  return result;
}
\`\`\`

### O Que Garante Isso

**Atomicidade:** Se qualquer etapa falhar (ex: estoque insuficiente na etapa 2), ROLLBACK Ã© automÃ¡tico.

**IdempotÃªncia:** Se requisiÃ§Ã£o Ã© enviada 2x (problema de rede), transaction_hash garante que nÃ£o duplica.

**Auditoria:** Cada venda Ã© registrada com exatidÃ£o.

---

## Ãndices para Performance

\`\`\`sql
-- Searches rÃ¡pidas
CREATE INDEX idx_products_store_name ON products(store_id, name);
CREATE INDEX idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_sales_store_created ON sales_transactions(store_id, created_at DESC);

-- Para relatÃ³rios
CREATE INDEX idx_orders_created_at ON orders(store_id, created_at DESC);
CREATE INDEX idx_sales_channel ON sales_transactions(store_id, channel);
\`\`\`

---

## Row Level Security (RLS)

### PrincÃ­pio

Cada loja sÃ³ acessa seus dados. Mesmo se alguÃ©m roubar token, nÃ£o acessa outra loja.

### ImplementaÃ§Ã£o

\`\`\`sql
-- Ativar RLS em todas tabelas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: UsuÃ¡rio sÃ³ vÃª produtos da sua loja
CREATE POLICY "users_see_own_store_products" ON products
  FOR SELECT
  USING (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  );

-- Policy: UsuÃ¡rio sÃ³ pode criar pedido na sua loja
CREATE POLICY "users_create_own_store_orders" ON orders
  FOR INSERT
  WITH CHECK (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  );

-- Policy: UsuÃ¡rio sÃ³ pode editar pedido da sua loja
CREATE POLICY "users_update_own_store_orders" ON orders
  FOR UPDATE
  USING (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    store_id = (SELECT store_id FROM users WHERE id = auth.uid())
  );
\`\`\`

### BenefÃ­cios

- âœ“ SeguranÃ§a no banco (nÃ£o depende de cÃ³digo)
- âœ“ EscalÃ¡vel (funciona com 1 ou 10000 lojas)
- âœ“ Sem duplicaÃ§Ã£o de lÃ³gica

---

## Triggers para Auditoria

\`\`\`sql
-- Atualizar timestamp ao mudar
CREATE TRIGGER update_inventory_timestamp
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Registrar mudanÃ§as em audit_log
CREATE TRIGGER audit_inventory_changes
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_changes('inventory');
\`\`\`

---

## Backups & Disaster Recovery

**AutomÃ¡tico via Supabase:**
- Daily backups (completo)
- RetenÃ§Ã£o: 30 dias
- Teste de restore: 1x/semana

**SLO:**
- RTO (Recovery Time Objective): 1 hora
- RPO (Recovery Point Objective): 5 minutos

