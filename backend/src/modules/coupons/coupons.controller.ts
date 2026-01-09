import { Controller, Post, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { CouponsService } from './coupons.service';
import { UpsertDevCouponDto } from './dto/upsert-dev-coupon.dto';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Endpoint simples e idempotente para garantir um cupom de teste em dev/test (usado pelo E2E).
  @Post('dev/upsert')
  @UseGuards(JwtAuthGuard)
  async upsertDev(@CurrentTenant() tenantId: string, @Body() body: UpsertDevCouponDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return await this.couponsService.upsertDevCoupon(tenantId, body?.code);
  }
}

