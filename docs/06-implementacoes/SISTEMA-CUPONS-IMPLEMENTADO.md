# 🎟️ Sistema de Cupons - Documentação Completa

> **Data:** 08/01/2025  
> **Versão:** 1.0  
> **Status:** ✅ **100% IMPLEMENTADO E EM PRODUÇÃO**  
> **Localização:** `backend/src/modules/coupons/`

---

## 🎯 PROPÓSITO

Sistema completo de cupons de desconto que permite criar, validar, calcular e consumir cupons em pedidos, com suporte a descontos percentuais e fixos, limites de uso, validade e valores mínimos de compra.

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Arquitetura](#arquitetura)
4. [API Completa](#api-completa)
5. [Integração com Pedidos](#integração-com-pedidos)
6. [Exemplos de Uso](#exemplos-de-uso)
7. [Validações](#validações)
8. [Proteção contra Corrida](#proteção-contra-corrida)
9. [Boas Práticas](#boas-práticas)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

### O Que Faz

O sistema de cupons permite:
- ✅ Criar cupons com desconto percentual ou fixo
- ✅ Validar cupons (ativo, expirado, esgotado, valor mínimo)
- ✅ Calcular desconto automaticamente
- ✅ Consumir cupom (incrementar `used_count`)
- ✅ Proteção contra uso simultâneo (race condition)
- ✅ Integração automática com pedidos

---

## ✨ FUNCIONALIDADES

### 1. **Tipos de Desconto**

#### Desconto Percentual
```typescript
{
  discount_type: 'percentage',
  discount_value: 10, // 10% de desconto
  max_discount_amount: 50.00 // Máximo R$ 50,00
}
```

**Exemplo:**
- Subtotal: R$ 100,00
- Desconto: 10% = R$ 10,00
- Se `max_discount_amount = 50.00`: desconto = R$ 10,00 ✅
- Se `max_discount_amount = 5.00`: desconto = R$ 5,00 (limitado)

---

#### Desconto Fixo
```typescript
{
  discount_type: 'fixed',
  discount_value: 20.00 // R$ 20,00 de desconto
}
```

**Exemplo:**
- Subtotal: R$ 100,00
- Desconto: R$ 20,00
- Total: R$ 80,00

---

### 2. **Validações Automáticas**

✅ **Cupom Ativo:**
- Verifica se `is_active = true`

✅ **Validade:**
- Verifica se está entre `valid_from` e `valid_until`

✅ **Limite de Uso:**
- Verifica se `used_count < usage_limit`

✅ **Valor Mínimo:**
- Verifica se `subtotal >= min_purchase_amount`

✅ **Desconto Válido:**
- Verifica se o desconto calculado é > 0

---

### 3. **Proteção contra Corrida**

O sistema protege contra uso simultâneo do mesmo cupom:

```sql
UPDATE cupons_desconto
SET used_count = used_count + 1
WHERE tenant_id = :tenantId
  AND code = :code
  AND is_active = true
  AND (usage_limit IS NULL OR used_count < usage_limit)
```

**Como funciona:**
- Atualização atômica dentro de transação
- Se `used_count` já atingiu o limite, `affected = 0`
- Sistema detecta e rejeita o cupom

---

## 🏗️ ARQUITETURA

### Entidade

**Arquivo:** `backend/src/database/entities/CupomDesconto.entity.ts`

```typescript
@Entity('cupons_desconto')
export class CupomDesconto {
  id: string;
  tenant_id: string;
  code: string; // Código único (ex: "PROMO10")
  discount_type: TipoDesconto; // 'percentage' | 'fixed'
  discount_value: number; // Valor do desconto
  min_purchase_amount?: number; // Compra mínima
  max_discount_amount?: number; // Desconto máximo (para %)
  usage_limit?: number; // Limite de usos
  used_count: number; // Usos atuais
  is_active: boolean; // Ativo?
  valid_from?: Date; // Válido a partir de
  valid_until?: Date; // Válido até
  created_at: Date;
}
```

---

### Schema SQL

**Arquivo:** `scripts/migrations/001-initial-schema.sql`

```sql
CREATE TYPE tipo_desconto AS ENUM ('percentage', 'fixed');

CREATE TABLE cupons_desconto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type tipo_desconto NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  min_purchase_amount NUMERIC(10,2),
  max_discount_amount NUMERIC(10,2),
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cupons_tenant ON cupons_desconto(tenant_id);
CREATE INDEX idx_cupons_code ON cupons_desconto(code);
```

---

## 📚 API COMPLETA

### `CouponsService`

**Arquivo:** `backend/src/modules/coupons/coupons.service.ts`

---

#### `findActiveByCode(tenantId: string, code: string): Promise<CupomDesconto | null>`

Busca um cupom ativo por código.

```typescript
const cupom = await couponsService.findActiveByCode(tenantId, 'PROMO10');
if (!cupom) {
  throw new NotFoundException('Cupom não encontrado');
}
```

**Parâmetros:**
- `tenantId`: ID do tenant
- `code`: Código do cupom (case-insensitive, normalizado para UPPERCASE)

**Retorna:**
- `CupomDesconto` se encontrado e ativo
- `null` se não encontrado ou inativo

---

#### `computeDiscount(subtotal: number, coupon: CupomDesconto): number`

Calcula o valor do desconto baseado no subtotal e no cupom.

```typescript
const subtotal = 100.00;
const desconto = couponsService.computeDiscount(subtotal, cupom);
// Retorna: 10.00 (se 10% de desconto)
```

**Lógica:**
1. Se `discount_type = 'percentage'`: `desconto = subtotal * discount_value / 100`
2. Se `discount_type = 'fixed'`: `desconto = discount_value`
3. Se `max_discount_amount` existe: `desconto = min(desconto, max_discount_amount)`
4. `desconto = min(desconto, subtotal)` (nunca maior que o subtotal)
5. `desconto = max(desconto, 0)` (nunca negativo)

**Retorna:** Valor do desconto (número com 2 casas decimais)

---

#### `validateCoupon(subtotal: number, coupon: CupomDesconto): CouponComputeResult`

Valida um cupom completo e retorna o resultado.

```typescript
const resultado = couponsService.validateCoupon(100.00, cupom);

if (resultado.valid) {
  console.log(`Desconto: R$ ${resultado.discountAmount}`);
  console.log(`Cupom: ${resultado.code}`);
} else {
  console.error(`Cupom inválido: ${resultado.reason}`);
}
```

**Validações:**
1. ✅ Subtotal válido (> 0)
2. ✅ Cupom ativo (`is_active = true`)
3. ✅ Dentro da validade (`valid_from` e `valid_until`)
4. ✅ Não esgotado (`used_count < usage_limit`)
5. ✅ Valor mínimo atendido (`subtotal >= min_purchase_amount`)
6. ✅ Desconto > 0

**Retorna:**
```typescript
type CouponComputeResult =
  | {
      valid: true;
      coupon: CupomDesconto;
      discountAmount: number;
      code: string;
    }
  | {
      valid: false;
      reason: string;
    };
```

---

#### `upsertDevCoupon(tenantId: string, code?: string): Promise<CupomDesconto>`

Cria ou atualiza um cupom de desenvolvimento.

```typescript
const cupom = await couponsService.upsertDevCoupon(tenantId, 'DEV10');
// Cria cupom: 10% de desconto, sem limites
```

**Parâmetros:**
- `tenantId`: ID do tenant
- `code`: Código do cupom (opcional, padrão: "DEV10")

**Comportamento:**
- Se cupom existe: atualiza para ativo, 10% de desconto
- Se não existe: cria novo cupom com 10% de desconto

**Uso:** Apenas para desenvolvimento/testes

---

## 🔗 INTEGRAÇÃO COM PEDIDOS

### Como Funciona

O sistema de cupons está **totalmente integrado** com `OrdersService.create()`:

```typescript
async create(createOrderDto: CreateOrderDto, tenantId: string): Promise<Pedido> {
  // 1. Calcular subtotal
  const subtotal = createOrderDto.items.reduce(...);

  // 2. Validar e calcular desconto do cupom
  let couponCode = createOrderDto.coupon_code?.trim().toUpperCase();
  let discount = 0;
  
  if (couponCode) {
    const coupon = await this.couponsService.findActiveByCode(tenantId, couponCode);
    if (!coupon) {
      throw new BadRequestException(`Cupom inválido: ${couponCode}`);
    }
    
    const validation = this.couponsService.validateCoupon(subtotal, coupon);
    if (!validation.valid) {
      throw new BadRequestException(`Cupom inválido: ${validation.reason}`);
    }
    
    discount = validation.discountAmount;
  }

  // 3. Criar pedido dentro de transação
  const pedido = await this.db.runInTransaction(async (manager) => {
    // ... criar pedido com desconto ...
    
    // 4. Consumir cupom (dentro da transação)
    if (couponCode) {
      const res = await manager
        .createQueryBuilder()
        .update(CupomDesconto)
        .set({ used_count: () => '"used_count" + 1' })
        .where('tenant_id = :tenantId', { tenantId })
        .andWhere('code = :code', { code: couponCode })
        .andWhere('is_active = true')
        .andWhere('(usage_limit IS NULL OR used_count < usage_limit)')
        .execute();
      
      if (!res.affected || res.affected < 1) {
        throw new BadRequestException(`Cupom esgotado: ${couponCode}`);
      }
    }
    
    return pedido;
  });
}
```

---

### Fluxo Completo

```
1. Cliente envia pedido com coupon_code
   ↓
2. OrdersService.create() recebe CreateOrderDto
   ↓
3. Calcula subtotal dos itens
   ↓
4. Se tem coupon_code:
   ↓
5. Busca cupom (findActiveByCode)
   ↓
6. Valida cupom (validateCoupon)
   ↓
7. Calcula desconto (computeDiscount)
   ↓
8. Abre transação
   ↓
9. Cria pedido com desconto
   ↓
10. Consome cupom (incrementa used_count)
   ↓
11. COMMIT (ou ROLLBACK se erro)
```

---

## 💡 EXEMPLOS DE USO

### Exemplo 1: Criar Cupom Percentual

```typescript
const cupom = await couponsRepo.save({
  tenant_id: tenantId,
  code: 'PROMO10',
  discount_type: TipoDesconto.PERCENTAGE,
  discount_value: 10, // 10%
  min_purchase_amount: 50.00, // Mínimo R$ 50,00
  max_discount_amount: 20.00, // Máximo R$ 20,00
  usage_limit: 100, // 100 usos
  is_active: true,
  valid_from: new Date('2025-01-01'),
  valid_until: new Date('2025-12-31'),
});
```

**Resultado:**
- Subtotal R$ 100,00 → Desconto R$ 10,00 (10%)
- Subtotal R$ 300,00 → Desconto R$ 20,00 (limitado ao máximo)
- Subtotal R$ 30,00 → Cupom inválido (abaixo do mínimo)

---

### Exemplo 2: Criar Cupom Fixo

```typescript
const cupom = await couponsRepo.save({
  tenant_id: tenantId,
  code: 'FRETE20',
  discount_type: TipoDesconto.FIXED,
  discount_value: 20.00, // R$ 20,00 fixo
  min_purchase_amount: 100.00,
  usage_limit: null, // Ilimitado
  is_active: true,
});
```

**Resultado:**
- Subtotal R$ 100,00 → Desconto R$ 20,00
- Subtotal R$ 50,00 → Cupom inválido (abaixo do mínimo)

---

### Exemplo 3: Usar Cupom em Pedido

```typescript
// Via API
POST /api/v1/orders
{
  "items": [...],
  "channel": "whatsapp",
  "coupon_code": "PROMO10"
}

// O sistema automaticamente:
// 1. Valida o cupom
// 2. Calcula o desconto
// 3. Aplica no pedido
// 4. Consome o cupom (incrementa used_count)
```

---

### Exemplo 4: Validar Cupom Manualmente

```typescript
const cupom = await couponsService.findActiveByCode(tenantId, 'PROMO10');
if (!cupom) {
  throw new NotFoundException('Cupom não encontrado');
}

const resultado = couponsService.validateCoupon(100.00, cupom);
if (!resultado.valid) {
  throw new BadRequestException(resultado.reason);
}

console.log(`Desconto: R$ ${resultado.discountAmount}`);
```

---

## ✅ VALIDAÇÕES

### Validações Implementadas

1. **Cupom Existe:**
   ```typescript
   if (!cupom) {
     throw new BadRequestException('Cupom não encontrado');
   }
   ```

2. **Cupom Ativo:**
   ```typescript
   if (!cupom.is_active) {
     return { valid: false, reason: 'Cupom inativo' };
   }
   ```

3. **Dentro da Validade:**
   ```typescript
   if (cupom.valid_from && now < cupom.valid_from) {
     return { valid: false, reason: 'Cupom ainda não está válido' };
   }
   if (cupom.valid_until && now > cupom.valid_until) {
     return { valid: false, reason: 'Cupom expirado' };
   }
   ```

4. **Não Esgotado:**
   ```typescript
   if (cupom.usage_limit && cupom.used_count >= cupom.usage_limit) {
     return { valid: false, reason: 'Cupom esgotado' };
   }
   ```

5. **Valor Mínimo:**
   ```typescript
   if (cupom.min_purchase_amount && subtotal < cupom.min_purchase_amount) {
     return { valid: false, reason: `Compra mínima: R$ ${min}` };
   }
   ```

6. **Desconto > 0:**
   ```typescript
   const discountAmount = computeDiscount(subtotal, cupom);
   if (discountAmount <= 0) {
     return { valid: false, reason: 'Cupom não gera desconto' };
   }
   ```

---

## 🔒 PROTEÇÃO CONTRA CORRIDA

### Problema

Se dois pedidos usam o mesmo cupom simultaneamente:
1. Ambos leem `used_count = 99` (limite = 100)
2. Ambos validam: `99 < 100` ✅
3. Ambos incrementam: `used_count = 100`
4. **Resultado:** Cupom usado 2 vezes quando deveria ser usado apenas 1

---

### Solução

**Atualização Atômica dentro de Transação:**

```typescript
const res = await manager
  .createQueryBuilder()
  .update(CupomDesconto)
  .set({ used_count: () => '"used_count" + 1' })
  .where('tenant_id = :tenantId', { tenantId })
  .andWhere('code = :code', { code: couponCode })
  .andWhere('is_active = true')
  .andWhere('(usage_limit IS NULL OR used_count < usage_limit)')
  .execute();

if (!res.affected || res.affected < 1) {
  throw new BadRequestException(`Cupom esgotado: ${couponCode}`);
}
```

**Como Funciona:**
1. UPDATE verifica condição **e atualiza** em uma única operação atômica
2. Se `used_count` já atingiu o limite, `affected = 0`
3. Sistema detecta e rejeita o cupom
4. **Resultado:** Apenas 1 pedido consegue usar o cupom

---

## ✅ BOAS PRÁTICAS

### 1. **Sempre normalize o código do cupom**

✅ **Bom:**
```typescript
const normalized = (code || '').trim().toUpperCase();
```

❌ **Ruim:**
```typescript
const code = req.body.coupon_code; // Pode ter espaços, maiúsculas/minúsculas
```

---

### 2. **Valide o cupom antes de criar o pedido**

✅ **Bom:**
```typescript
const validation = couponsService.validateCoupon(subtotal, cupom);
if (!validation.valid) {
  throw new BadRequestException(validation.reason);
}
```

❌ **Ruim:**
```typescript
// Validar depois de criar pedido - muito tarde!
```

---

### 3. **Consuma o cupom dentro da transação**

✅ **Bom:**
```typescript
await this.db.runInTransaction(async (manager) => {
  // Criar pedido
  // Consumir cupom (dentro da mesma transação)
});
```

❌ **Ruim:**
```typescript
// Criar pedido
// Consumir cupom (fora da transação - pode falhar e deixar pedido sem cupom)
```

---

### 4. **Use mensagens de erro claras**

✅ **Bom:**
```typescript
throw new BadRequestException(`Cupom inválido: ${validation.reason}`);
// Ex: "Cupom inválido: Compra mínima: R$ 50,00"
```

❌ **Ruim:**
```typescript
throw new BadRequestException('Cupom inválido');
// Não diz o porquê
```

---

## 🐛 TROUBLESHOOTING

### Problema: "Cupom não encontrado"

**Causa:** Código do cupom não existe ou está inativo.

**Solução:**
1. Verifique se o código está correto (case-insensitive)
2. Verifique se o cupom está ativo (`is_active = true`)
3. Verifique se o cupom pertence ao tenant correto

---

### Problema: "Cupom esgotado"

**Causa:** `used_count >= usage_limit`.

**Solução:**
1. Verifique o limite de uso do cupom
2. Verifique quantas vezes já foi usado
3. Crie novo cupom se necessário

---

### Problema: "Cupom não gera desconto"

**Causa:** Desconto calculado é 0 ou negativo.

**Possíveis causas:**
- Subtotal muito baixo (desconto percentual muito pequeno)
- `max_discount_amount` muito baixo
- `discount_value` = 0

**Solução:**
1. Verifique o subtotal do pedido
2. Verifique os valores do cupom
3. Ajuste o cupom se necessário

---

### Problema: "Cupom usado múltiplas vezes simultaneamente"

**Causa:** Não está usando atualização atômica.

**Solução:**
1. Certifique-se de que o consumo está dentro de uma transação
2. Use UPDATE com condição `used_count < usage_limit`
3. Verifique se `affected > 0` antes de aceitar

---

## 📊 ONDE É USADO

- ✅ **OrdersService** - Integração completa com criação de pedidos
- ✅ **WhatsappService** - Suporte a cupons em pedidos via WhatsApp
- ✅ **CouponsController** - Endpoints para gerenciar cupons (CRUD)

---

## 🔗 RELACIONADOS

- **[DbContextService](../01-tecnico/DBCONTEXT-SERVICE.md)** - Gerencia transações
- **[OrdersService](./STATUS-ATUAL-FASE-3-3.md)** - Integração com pedidos
- **[Database Schema](../01-tecnico/04-DATABASE.md)** - Schema do banco

---

## 📝 RESUMO

**O que é:** Sistema completo de cupons de desconto  
**Funcionalidades:** Validação, cálculo, consumo, proteção contra corrida  
**Integração:** Totalmente integrado com pedidos  
**Uso:** Automático ao criar pedido com `coupon_code`

---

**Última atualização:** 08/01/2025  
**Status:** ✅ **DOCUMENTAÇÃO COMPLETA**
