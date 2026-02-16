> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# ðŸŽŸï¸ Sistema de Cupons - DocumentaÃ§Ã£o Completa

> **Data:** 08/01/2025  
> **VersÃ£o:** 1.0  
> **Status:** âœ… **100% IMPLEMENTADO E EM PRODUÃ‡ÃƒO**  
> **LocalizaÃ§Ã£o:** `backend/src/modules/coupons/`

---

## ðŸŽ¯ PROPÃ“SITO

Sistema completo de cupons de desconto que permite criar, validar, calcular e consumir cupons em pedidos, com suporte a descontos percentuais e fixos, limites de uso, validade e valores mÃ­nimos de compra.

---

## ðŸ“‹ ÃNDICE

1. [VisÃ£o Geral](#visÃ£o-geral)
2. [Funcionalidades](#funcionalidades)
3. [Arquitetura](#arquitetura)
4. [API Completa](#api-completa)
5. [IntegraÃ§Ã£o com Pedidos](#integraÃ§Ã£o-com-pedidos)
6. [Exemplos de Uso](#exemplos-de-uso)
7. [ValidaÃ§Ãµes](#validaÃ§Ãµes)
8. [ProteÃ§Ã£o contra Corrida](#proteÃ§Ã£o-contra-corrida)
9. [Boas PrÃ¡ticas](#boas-prÃ¡ticas)
10. [Troubleshooting](#troubleshooting)

---

## ðŸŽ¯ VISÃƒO GERAL

### O Que Faz

O sistema de cupons permite:
- âœ… Criar cupons com desconto percentual ou fixo
- âœ… Validar cupons (ativo, expirado, esgotado, valor mÃ­nimo)
- âœ… Calcular desconto automaticamente
- âœ… Consumir cupom (incrementar `used_count`)
- âœ… ProteÃ§Ã£o contra uso simultÃ¢neo (race condition)
- âœ… IntegraÃ§Ã£o automÃ¡tica com pedidos

---

## âœ¨ FUNCIONALIDADES

### 1. **Tipos de Desconto**

#### Desconto Percentual
```typescript
{
  discount_type: 'percentage',
  discount_value: 10, // 10% de desconto
  max_discount_amount: 50.00 // MÃ¡ximo R$ 50,00
}
```

**Exemplo:**
- Subtotal: R$ 100,00
- Desconto: 10% = R$ 10,00
- Se `max_discount_amount = 50.00`: desconto = R$ 10,00 âœ…
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

### 2. **ValidaÃ§Ãµes AutomÃ¡ticas**

âœ… **Cupom Ativo:**
- Verifica se `is_active = true`

âœ… **Validade:**
- Verifica se estÃ¡ entre `valid_from` e `valid_until`

âœ… **Limite de Uso:**
- Verifica se `used_count < usage_limit`

âœ… **Valor MÃ­nimo:**
- Verifica se `subtotal >= min_purchase_amount`

âœ… **Desconto VÃ¡lido:**
- Verifica se o desconto calculado Ã© > 0

---

### 3. **ProteÃ§Ã£o contra Corrida**

O sistema protege contra uso simultÃ¢neo do mesmo cupom:

```sql
UPDATE cupons_desconto
SET used_count = used_count + 1
WHERE tenant_id = :tenantId
  AND code = :code
  AND is_active = true
  AND (usage_limit IS NULL OR used_count < usage_limit)
```

**Como funciona:**
- AtualizaÃ§Ã£o atÃ´mica dentro de transaÃ§Ã£o
- Se `used_count` jÃ¡ atingiu o limite, `affected = 0`
- Sistema detecta e rejeita o cupom

---

## ðŸ—ï¸ ARQUITETURA

### Entidade

**Arquivo:** `backend/src/database/entities/CupomDesconto.entity.ts`

```typescript
@Entity('cupons_desconto')
export class CupomDesconto {
  id: string;
  tenant_id: string;
  code: string; // CÃ³digo Ãºnico (ex: "PROMO10")
  discount_type: TipoDesconto; // 'percentage' | 'fixed'
  discount_value: number; // Valor do desconto
  min_purchase_amount?: number; // Compra mÃ­nima
  max_discount_amount?: number; // Desconto mÃ¡ximo (para %)
  usage_limit?: number; // Limite de usos
  used_count: number; // Usos atuais
  is_active: boolean; // Ativo?
  valid_from?: Date; // VÃ¡lido a partir de
  valid_until?: Date; // VÃ¡lido atÃ©
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

## ðŸ“š API COMPLETA

### `CouponsService`

**Arquivo:** `backend/src/modules/coupons/coupons.service.ts`

---

#### `findActiveByCode(tenantId: string, code: string): Promise<CupomDesconto | null>`

Busca um cupom ativo por cÃ³digo.

```typescript
const cupom = await couponsService.findActiveByCode(tenantId, 'PROMO10');
if (!cupom) {
  throw new NotFoundException('Cupom nÃ£o encontrado');
}
```

**ParÃ¢metros:**
- `tenantId`: ID do tenant
- `code`: CÃ³digo do cupom (case-insensitive, normalizado para UPPERCASE)

**Retorna:**
- `CupomDesconto` se encontrado e ativo
- `null` se nÃ£o encontrado ou inativo

---

#### `computeDiscount(subtotal: number, coupon: CupomDesconto): number`

Calcula o valor do desconto baseado no subtotal e no cupom.

```typescript
const subtotal = 100.00;
const desconto = couponsService.computeDiscount(subtotal, cupom);
// Retorna: 10.00 (se 10% de desconto)
```

**LÃ³gica:**
1. Se `discount_type = 'percentage'`: `desconto = subtotal * discount_value / 100`
2. Se `discount_type = 'fixed'`: `desconto = discount_value`
3. Se `max_discount_amount` existe: `desconto = min(desconto, max_discount_amount)`
4. `desconto = min(desconto, subtotal)` (nunca maior que o subtotal)
5. `desconto = max(desconto, 0)` (nunca negativo)

**Retorna:** Valor do desconto (nÃºmero com 2 casas decimais)

---

#### `validateCoupon(subtotal: number, coupon: CupomDesconto): CouponComputeResult`

Valida um cupom completo e retorna o resultado.

```typescript
const resultado = couponsService.validateCoupon(100.00, cupom);

if (resultado.valid) {
  console.log(`Desconto: R$ ${resultado.discountAmount}`);
  console.log(`Cupom: ${resultado.code}`);
} else {
  console.error(`Cupom invÃ¡lido: ${resultado.reason}`);
}
```

**ValidaÃ§Ãµes:**
1. âœ… Subtotal vÃ¡lido (> 0)
2. âœ… Cupom ativo (`is_active = true`)
3. âœ… Dentro da validade (`valid_from` e `valid_until`)
4. âœ… NÃ£o esgotado (`used_count < usage_limit`)
5. âœ… Valor mÃ­nimo atendido (`subtotal >= min_purchase_amount`)
6. âœ… Desconto > 0

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

**ParÃ¢metros:**
- `tenantId`: ID do tenant
- `code`: CÃ³digo do cupom (opcional, padrÃ£o: "DEV10")

**Comportamento:**
- Se cupom existe: atualiza para ativo, 10% de desconto
- Se nÃ£o existe: cria novo cupom com 10% de desconto

**Uso:** Apenas para desenvolvimento/testes

---

## ðŸ”— INTEGRAÃ‡ÃƒO COM PEDIDOS

### Como Funciona

O sistema de cupons estÃ¡ **totalmente integrado** com `OrdersService.create()`:

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
      throw new BadRequestException(`Cupom invÃ¡lido: ${couponCode}`);
    }
    
    const validation = this.couponsService.validateCoupon(subtotal, coupon);
    if (!validation.valid) {
      throw new BadRequestException(`Cupom invÃ¡lido: ${validation.reason}`);
    }
    
    discount = validation.discountAmount;
  }

  // 3. Criar pedido dentro de transaÃ§Ã£o
  const pedido = await this.db.runInTransaction(async (manager) => {
    // ... criar pedido com desconto ...
    
    // 4. Consumir cupom (dentro da transaÃ§Ã£o)
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
   â†“
2. OrdersService.create() recebe CreateOrderDto
   â†“
3. Calcula subtotal dos itens
   â†“
4. Se tem coupon_code:
   â†“
5. Busca cupom (findActiveByCode)
   â†“
6. Valida cupom (validateCoupon)
   â†“
7. Calcula desconto (computeDiscount)
   â†“
8. Abre transaÃ§Ã£o
   â†“
9. Cria pedido com desconto
   â†“
10. Consome cupom (incrementa used_count)
   â†“
11. COMMIT (ou ROLLBACK se erro)
```

---

## ðŸ’¡ EXEMPLOS DE USO

### Exemplo 1: Criar Cupom Percentual

```typescript
const cupom = await couponsRepo.save({
  tenant_id: tenantId,
  code: 'PROMO10',
  discount_type: TipoDesconto.PERCENTAGE,
  discount_value: 10, // 10%
  min_purchase_amount: 50.00, // MÃ­nimo R$ 50,00
  max_discount_amount: 20.00, // MÃ¡ximo R$ 20,00
  usage_limit: 100, // 100 usos
  is_active: true,
  valid_from: new Date('2025-01-01'),
  valid_until: new Date('2025-12-31'),
});
```

**Resultado:**
- Subtotal R$ 100,00 â†’ Desconto R$ 10,00 (10%)
- Subtotal R$ 300,00 â†’ Desconto R$ 20,00 (limitado ao mÃ¡ximo)
- Subtotal R$ 30,00 â†’ Cupom invÃ¡lido (abaixo do mÃ­nimo)

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
- Subtotal R$ 100,00 â†’ Desconto R$ 20,00
- Subtotal R$ 50,00 â†’ Cupom invÃ¡lido (abaixo do mÃ­nimo)

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
  throw new NotFoundException('Cupom nÃ£o encontrado');
}

const resultado = couponsService.validateCoupon(100.00, cupom);
if (!resultado.valid) {
  throw new BadRequestException(resultado.reason);
}

console.log(`Desconto: R$ ${resultado.discountAmount}`);
```

---

## âœ… VALIDAÃ‡Ã•ES

### ValidaÃ§Ãµes Implementadas

1. **Cupom Existe:**
   ```typescript
   if (!cupom) {
     throw new BadRequestException('Cupom nÃ£o encontrado');
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
     return { valid: false, reason: 'Cupom ainda nÃ£o estÃ¡ vÃ¡lido' };
   }
   if (cupom.valid_until && now > cupom.valid_until) {
     return { valid: false, reason: 'Cupom expirado' };
   }
   ```

4. **NÃ£o Esgotado:**
   ```typescript
   if (cupom.usage_limit && cupom.used_count >= cupom.usage_limit) {
     return { valid: false, reason: 'Cupom esgotado' };
   }
   ```

5. **Valor MÃ­nimo:**
   ```typescript
   if (cupom.min_purchase_amount && subtotal < cupom.min_purchase_amount) {
     return { valid: false, reason: `Compra mÃ­nima: R$ ${min}` };
   }
   ```

6. **Desconto > 0:**
   ```typescript
   const discountAmount = computeDiscount(subtotal, cupom);
   if (discountAmount <= 0) {
     return { valid: false, reason: 'Cupom nÃ£o gera desconto' };
   }
   ```

---

## ðŸ”’ PROTEÃ‡ÃƒO CONTRA CORRIDA

### Problema

Se dois pedidos usam o mesmo cupom simultaneamente:
1. Ambos leem `used_count = 99` (limite = 100)
2. Ambos validam: `99 < 100` âœ…
3. Ambos incrementam: `used_count = 100`
4. **Resultado:** Cupom usado 2 vezes quando deveria ser usado apenas 1

---

### SoluÃ§Ã£o

**AtualizaÃ§Ã£o AtÃ´mica dentro de TransaÃ§Ã£o:**

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
1. UPDATE verifica condiÃ§Ã£o **e atualiza** em uma Ãºnica operaÃ§Ã£o atÃ´mica
2. Se `used_count` jÃ¡ atingiu o limite, `affected = 0`
3. Sistema detecta e rejeita o cupom
4. **Resultado:** Apenas 1 pedido consegue usar o cupom

---

## âœ… BOAS PRÃTICAS

### 1. **Sempre normalize o cÃ³digo do cupom**

âœ… **Bom:**
```typescript
const normalized = (code || '').trim().toUpperCase();
```

âŒ **Ruim:**
```typescript
const code = req.body.coupon_code; // Pode ter espaÃ§os, maiÃºsculas/minÃºsculas
```

---

### 2. **Valide o cupom antes de criar o pedido**

âœ… **Bom:**
```typescript
const validation = couponsService.validateCoupon(subtotal, cupom);
if (!validation.valid) {
  throw new BadRequestException(validation.reason);
}
```

âŒ **Ruim:**
```typescript
// Validar depois de criar pedido - muito tarde!
```

---

### 3. **Consuma o cupom dentro da transaÃ§Ã£o**

âœ… **Bom:**
```typescript
await this.db.runInTransaction(async (manager) => {
  // Criar pedido
  // Consumir cupom (dentro da mesma transaÃ§Ã£o)
});
```

âŒ **Ruim:**
```typescript
// Criar pedido
// Consumir cupom (fora da transaÃ§Ã£o - pode falhar e deixar pedido sem cupom)
```

---

### 4. **Use mensagens de erro claras**

âœ… **Bom:**
```typescript
throw new BadRequestException(`Cupom invÃ¡lido: ${validation.reason}`);
// Ex: "Cupom invÃ¡lido: Compra mÃ­nima: R$ 50,00"
```

âŒ **Ruim:**
```typescript
throw new BadRequestException('Cupom invÃ¡lido');
// NÃ£o diz o porquÃª
```

---

## ðŸ› TROUBLESHOOTING

### Problema: "Cupom nÃ£o encontrado"

**Causa:** CÃ³digo do cupom nÃ£o existe ou estÃ¡ inativo.

**SoluÃ§Ã£o:**
1. Verifique se o cÃ³digo estÃ¡ correto (case-insensitive)
2. Verifique se o cupom estÃ¡ ativo (`is_active = true`)
3. Verifique se o cupom pertence ao tenant correto

---

### Problema: "Cupom esgotado"

**Causa:** `used_count >= usage_limit`.

**SoluÃ§Ã£o:**
1. Verifique o limite de uso do cupom
2. Verifique quantas vezes jÃ¡ foi usado
3. Crie novo cupom se necessÃ¡rio

---

### Problema: "Cupom nÃ£o gera desconto"

**Causa:** Desconto calculado Ã© 0 ou negativo.

**PossÃ­veis causas:**
- Subtotal muito baixo (desconto percentual muito pequeno)
- `max_discount_amount` muito baixo
- `discount_value` = 0

**SoluÃ§Ã£o:**
1. Verifique o subtotal do pedido
2. Verifique os valores do cupom
3. Ajuste o cupom se necessÃ¡rio

---

### Problema: "Cupom usado mÃºltiplas vezes simultaneamente"

**Causa:** NÃ£o estÃ¡ usando atualizaÃ§Ã£o atÃ´mica.

**SoluÃ§Ã£o:**
1. Certifique-se de que o consumo estÃ¡ dentro de uma transaÃ§Ã£o
2. Use UPDATE com condiÃ§Ã£o `used_count < usage_limit`
3. Verifique se `affected > 0` antes de aceitar

---

## ðŸ“Š ONDE Ã‰ USADO

- âœ… **OrdersService** - IntegraÃ§Ã£o completa com criaÃ§Ã£o de pedidos
- âœ… **WhatsappService** - Suporte a cupons em pedidos via WhatsApp
- âœ… **CouponsController** - Endpoints para gerenciar cupons (CRUD)

---

## ðŸ”— RELACIONADOS

- **[DbContextService](../01-tecnico/DBCONTEXT-SERVICE.md)** - Gerencia transaÃ§Ãµes
- **[OrdersService](./STATUS-ATUAL-FASE-3-3.md)** - IntegraÃ§Ã£o com pedidos
- **[Database Schema](../01-tecnico/04-DATABASE.md)** - Schema do banco

---

## ðŸ“ RESUMO

**O que Ã©:** Sistema completo de cupons de desconto  
**Funcionalidades:** ValidaÃ§Ã£o, cÃ¡lculo, consumo, proteÃ§Ã£o contra corrida  
**IntegraÃ§Ã£o:** Totalmente integrado com pedidos  
**Uso:** AutomÃ¡tico ao criar pedido com `coupon_code`

---

**Ãšltima atualizaÃ§Ã£o:** 08/01/2025  
**Status:** âœ… **DOCUMENTAÃ‡ÃƒO COMPLETA**

