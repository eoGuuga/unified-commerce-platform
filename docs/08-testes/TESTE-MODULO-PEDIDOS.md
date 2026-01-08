# TESTE DO MÓDULO DE PEDIDOS

## IMPORTANTE: Este é o CORE do sistema

O módulo de Pedidos implementa a **SOLUÇÃO DE OVERSELLING** usando:
1. ✅ Transação ACID
2. ✅ FOR UPDATE lock (lock pessimista)
3. ✅ Validação de estoque
4. ✅ Abate automático de estoque
5. ✅ Geração de número de pedido

---

## Setup

```bash
# 1. Iniciar PostgreSQL (Docker)
docker-compose up -d postgres

# 2. Executar migration SQL
docker exec -i ucm-postgres psql -U postgres -d ucm < ../scripts/migrations/001-initial-schema.sql

# 3. Iniciar backend
cd backend
npm install
npm run start:dev
```

---

## TESTE 1: Criar Produto com Estoque

```bash
curl -X POST "http://localhost:3001/api/v1/products?tenantId=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Brigadeiro Gourmet",
    "price": 10.50,
    "description": "Brigadeiro feito com chocolate premium",
    "unit": "unidade"
  }'
```

**Copiar o ID do produto retornado** (exemplo: `abc-123`)

```bash
# 2. Cadastrar estoque manualmente no banco
docker exec -i ucm-postgres psql -U postgres -d ucm -c \
  "INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock, min_stock) 
   VALUES ('00000000-0000-0000-0000-000000000000', 'ABC-123', 50, 10);"
```

---

## TESTE 2: Criar Pedido (Sucesso)

```bash
curl -X POST "http://localhost:3001/api/v1/orders?tenantId=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "pdv",
    "customer_name": "João Silva",
    "items": [
      {
        "produto_id": "ABC-123",
        "quantity": 5,
        "unit_price": 10.50
      }
    ],
    "discount_amount": 0,
    "shipping_amount": 0
  }'
```

**Resultado esperado**: Pedido criado com sucesso
- `order_no`: PED-20241115-001
- `status`: entregue (pq é PDV)
- Estoque deve ter diminuído de 50 para 45

---

## TESTE 3: Verificar Estoque Atualizado

```bash
docker exec -i ucm-postgres psql -U postgres -d ucm -c \
  "SELECT produto_id, current_stock FROM movimentacoes_estoque WHERE produto_id = 'ABC-123';"
```

Deve mostrar: `current_stock = 45`

---

## TESTE 4: Tentar Overselling (FALHA)

```bash
curl -X POST "http://localhost:3001/api/v1/orders?tenantId=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "pdv",
    "items": [
      {
        "produto_id": "ABC-123",
        "quantity": 100,
        "unit_price": 10.50
      }
    ]
  }'
```

**Resultado esperado**: ERROR 400
```
{
  "statusCode": 400,
  "message": "Estoque insuficiente para produto ABC-123: necessário 100, disponível 45"
}
```

---

## TESTE 5: Race Condition (Simulação)

**Em 2 terminais simultâneos**, tentar criar pedidos para o mesmo estoque:

**Terminal 1:**
```bash
curl -X POST "http://localhost:3001/api/v1/orders?tenantId=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "ecommerce",
    "items": [{"produto_id": "ABC-123", "quantity": 40, "unit_price": 10.50}]
  }'
```

**Terminal 2 (executar imediatamente após):**
```bash
curl -X POST "http://localhost:3001/api/v1/orders?tenantId=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "ecommerce",
    "items": [{"produto_id": "ABC-123", "quantity": 40, "unit_price": 10.50}]
  }'
```

**Resultado esperado**:
- Um pedido **sucede** (estoque vai de 45 para 5)
- Um pedido **falha** (estoque insuficiente)

**O FOR UPDATE lock garante que não haverá overselling!**

---

## TESTE 6: Listar Pedidos

```bash
curl "http://localhost:3001/api/v1/orders?tenantId=00000000-0000-0000-0000-000000000000"
```

**Resultado**: Lista todos os pedidos criados

---

## TESTE 7: Buscar Pedido Específico

```bash
curl "http://localhost:3001/api/v1/orders/PED-ID?tenantId=00000000-0000-0000-0000-000000000000"
```

---

## TESTE 8: Atualizar Status

```bash
curl -X PATCH "http://localhost:3001/api/v1/orders/PED-ID/status?tenantId=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{"status": "em_producao"}'
```

---

## GARANTIAS IMPLEMENTADAS

✅ **Atomicidade**: Venda e abate de estoque acontecem juntos ou não acontecem
✅ **Sem Overselling**: FOR UPDATE lock previne race conditions
✅ **Auditoria**: Cada pedido registra quem, quando, e o quê
✅ **Multi-canal**: Funciona para PDV, E-commerce e WhatsApp

---

## PRÓXIMOS PASSOS

1. ✅ Módulo Orders implementado
2. ⏳ Implementar autenticação JWT
3. ⏳ Implementar WhatsApp Bot
4. ⏳ Implementar frontend PDV
