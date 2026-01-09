import { BadRequestException, Injectable } from '@nestjs/common';
import { CupomDesconto, TipoDesconto } from '../../database/entities/CupomDesconto.entity';
import { DbContextService } from '../common/services/db-context.service';

export type CouponComputeResult =
  | {
      valid: true;
      coupon: CupomDesconto;
      discountAmount: number;
      code: string;
    }
  | { valid: false; reason: string };

@Injectable()
export class CouponsService {
  constructor(private readonly db: DbContextService) {}

  async findActiveByCode(tenantId: string, code: string): Promise<CupomDesconto | null> {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return null;

    return await this.db.getRepository(CupomDesconto).findOne({
      where: {
        tenant_id: tenantId,
        code: normalized,
        is_active: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  computeDiscount(subtotal: number, coupon: CupomDesconto): number {
    const base = Number(subtotal || 0);
    if (!Number.isFinite(base) || base <= 0) return 0;

    let discount = 0;
    if (coupon.discount_type === TipoDesconto.PERCENTAGE) {
      discount = (base * Number(coupon.discount_value || 0)) / 100;
    } else if (coupon.discount_type === TipoDesconto.FIXED) {
      discount = Number(coupon.discount_value || 0);
    }

    // arredondar para 2 casas
    discount = Math.round(discount * 100) / 100;

    const max = coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null;
    if (max != null && Number.isFinite(max)) {
      discount = Math.min(discount, max);
    }

    // nunca maior que o subtotal
    discount = Math.min(discount, base);
    discount = Math.max(discount, 0);
    return discount;
  }

  validateCoupon(subtotal: number, coupon: CupomDesconto): CouponComputeResult {
    const now = new Date();
    const base = Number(subtotal || 0);
    if (!Number.isFinite(base) || base <= 0) {
      return { valid: false, reason: 'Subtotal inválido' };
    }

    if (!coupon.is_active) {
      return { valid: false, reason: 'Cupom inativo' };
    }

    if (coupon.valid_from && now < new Date(coupon.valid_from)) {
      return { valid: false, reason: 'Cupom ainda não está válido' };
    }

    if (coupon.valid_until && now > new Date(coupon.valid_until)) {
      return { valid: false, reason: 'Cupom expirado' };
    }

    if (coupon.usage_limit != null && coupon.used_count != null) {
      if (Number(coupon.used_count) >= Number(coupon.usage_limit)) {
        return { valid: false, reason: 'Cupom esgotado' };
      }
    }

    if (coupon.min_purchase_amount != null) {
      const min = Number(coupon.min_purchase_amount);
      if (Number.isFinite(min) && base < min) {
        return { valid: false, reason: `Compra mínima: R$ ${min.toFixed(2).replace('.', ',')}` };
      }
    }

    const discountAmount = this.computeDiscount(base, coupon);
    if (discountAmount <= 0) {
      return { valid: false, reason: 'Cupom não gera desconto para este pedido' };
    }

    return {
      valid: true,
      coupon,
      discountAmount,
      code: coupon.code,
    };
  }

  async upsertDevCoupon(tenantId: string, code?: string): Promise<CupomDesconto> {
    const normalized = (code || 'DEV10').trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Código de cupom inválido');
    }

    const couponsRepo = this.db.getRepository(CupomDesconto);
    let existing = await couponsRepo.findOne({
      where: { tenant_id: tenantId, code: normalized },
      order: { created_at: 'DESC' },
    });

    if (!existing) {
      existing = couponsRepo.create({
        tenant_id: tenantId,
        code: normalized,
        discount_type: TipoDesconto.PERCENTAGE,
        discount_value: 10,
        min_purchase_amount: null,
        max_discount_amount: null,
        usage_limit: null,
        used_count: 0,
        is_active: true,
        valid_from: null,
        valid_until: null,
      });
    } else {
      existing.is_active = true;
      existing.discount_type = TipoDesconto.PERCENTAGE;
      existing.discount_value = 10;
      existing.valid_until = null;
    }

    return await couponsRepo.save(existing);
  }
}

