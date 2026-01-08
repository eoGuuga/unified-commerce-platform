# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - PARTE 7/8

## 🔧 FUNCIONALIDADES EXTRAS

**Objetivo desta Parte:** Implementar funcionalidades adicionais para micro e médias empresas: gestão de produção, marketing, promoções e integrações com marketplaces.

**Tempo Estimado:** 3-4 semanas  
**Prioridade:** 🟢 MÉDIA (nice-to-have, diferenciais competitivos)

---

## 1. 🏭 GESTÃO DE PRODUÇÃO

### 1.1 Fila de Produção

**Arquivo:** `frontend/app/admin/producao/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface ProductionOrder {
  orderId: string;
  orderNo: string;
  items: Array<{
    produto_name: string;
    quantity: number;
    status: 'pending' | 'in_production' | 'ready';
  }>;
  estimatedTime: number; // minutos
  assignedTo?: string;
}

export default function ProducaoPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);

  const markAsReady = async (orderId: string, itemIndex: number) => {
    // Atualiza status do item
    // Notifica cliente via WhatsApp
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Fila de Produção</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Pendentes */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold mb-4">⏳ Pendentes</h2>
          {orders
            .filter((o) => o.items.some((i) => i.status === 'pending'))
            .map((order) => (
              <ProductionCard
                key={order.orderId}
                order={order}
                onStatusChange={markAsReady}
              />
            ))}
        </div>

        {/* Em Produção */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold mb-4">👷 Em Produção</h2>
          {orders
            .filter((o) => o.items.some((i) => i.status === 'in_production'))
            .map((order) => (
              <ProductionCard
                key={order.orderId}
                order={order}
                onStatusChange={markAsReady}
              />
            ))}
        </div>

        {/* Prontos */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold mb-4">✅ Prontos</h2>
          {orders
            .filter((o) => o.items.some((i) => i.status === 'ready'))
            .map((order) => (
              <ProductionCard
                key={order.orderId}
                order={order}
                onStatusChange={markAsReady}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 2. 🎁 MARKETING E PROMOÇÕES

### 2.1 Sistema de Cupons

**Arquivo:** `backend/src/modules/promotions/promotions.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from '../../database/entities/Coupon.entity';

export interface CreateCouponDTO {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase?: number;
  max_uses?: number;
  valid_from: Date;
  valid_until: Date;
}

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
  ) {}

  async createCoupon(tenantId: string, data: CreateCouponDTO) {
    const coupon = this.couponRepository.create({
      tenant_id: tenantId,
      ...data,
    });

    return this.couponRepository.save(coupon);
  }

  async validateCoupon(tenantId: string, code: string, total: number) {
    const coupon = await this.couponRepository.findOne({
      where: {
        tenant_id: tenantId,
        code,
        is_active: true,
      },
    });

    if (!coupon) {
      return { valid: false, error: 'Cupom inválido' };
    }

    // Validações
    if (new Date() < coupon.valid_from) {
      return { valid: false, error: 'Cupom ainda não está válido' };
    }

    if (new Date() > coupon.valid_until) {
      return { valid: false, error: 'Cupom expirado' };
    }

    if (coupon.min_purchase && total < coupon.min_purchase) {
      return {
        valid: false,
        error: `Compra mínima de R$ ${coupon.min_purchase}`,
      };
    }

    if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
      return { valid: false, error: 'Cupom esgotado' };
    }

    // Calcula desconto
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (total * coupon.discount_value) / 100;
    } else {
      discount = coupon.discount_value;
    }

    return {
      valid: true,
      discount,
      coupon_id: coupon.id,
    };
  }
}
```

---

## 3. 🔗 INTEGRAÇÕES COM MARKETPLACES

### 3.1 Integração Mercado Livre

**Arquivo:** `backend/src/modules/integrations/mercadolivre.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MercadoLivreService {
  private readonly logger = new Logger(MercadoLivreService.name);

  async syncProduct(tenantId: string, productId: string) {
    // Sincroniza produto com Mercado Livre
    // Cria ou atualiza anúncio
  }

  async syncOrder(tenantId: string, orderId: string) {
    // Sincroniza pedido do Mercado Livre
    // Cria pedido interno e abate estoque
  }

  async syncStock(tenantId: string, productId: string) {
    // Sincroniza estoque atualizado
  }
}
```

---

## 4. ✅ CHECKLIST DE IMPLEMENTAÇÃO - PARTE 7

### 4.1 Produção
- [ ] Fila de produção
- [ ] Atribuição de tarefas
- [ ] Estimativa de tempo
- [ ] Notificações

### 4.2 Marketing
- [ ] Sistema de cupons
- [ ] Campanhas WhatsApp
- [ ] Email marketing (integração)
- [ ] Programa de fidelidade

### 4.3 Integrações
- [ ] Mercado Livre
- [ ] iFood (se aplicável)
- [ ] Outras APIs

---

## 5. 📝 PRÓXIMOS PASSOS (Após Parte 7)

**PARTE 8:** Deploy, Monitoramento e Otimização
- Deploy em produção
- Monitoramento
- Performance
- Segurança

---

**Status:** ✅ PARTE 7 COMPLETA  
**Próxima Parte:** PARTE 8 - Deploy e Monitoramento
