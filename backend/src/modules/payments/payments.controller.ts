import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Query,
} from '@nestjs/common';
import { PaymentsService, CreatePaymentDto } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar pagamento para um pedido' })
  async createPayment(
    @CurrentTenant() tenantId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return await this.paymentsService.createPayment(tenantId, createPaymentDto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar pagamento (webhook ou manual)' })
  async confirmPayment(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return await this.paymentsService.confirmPayment(id, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar pagamento por ID' })
  async getPayment(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return await this.paymentsService.findById(id, tenantId);
  }

  @Get('pedido/:pedidoId')
  @ApiOperation({ summary: 'Buscar pagamentos de um pedido' })
  async getPaymentsByPedido(
    @CurrentTenant() tenantId: string,
    @Param('pedidoId') pedidoId: string,
  ) {
    return await this.paymentsService.findByPedido(pedidoId, tenantId);
  }

  @Public()
  @Post('webhook/mercadopago')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Mercado Pago (publico)' })
  async mercadoPagoWebhook(
    @Body() body: Record<string, any>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('token') token?: string,
  ) {
    const signature = String(headers['x-signature'] || headers['x-mp-signature'] || '');
    const requestId = String(headers['x-request-id'] || '');
    const tokenHeader = String(headers['x-webhook-token'] || '');

    return await this.paymentsService.handleMercadoPagoWebhook(body, {
      signature,
      requestId,
      token: tokenHeader || token,
    });
  }
}
