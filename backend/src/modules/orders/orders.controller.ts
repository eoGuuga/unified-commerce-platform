import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationDto } from './dto/pagination.dto';
import { PedidoStatus } from '../../database/entities/Pedido.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { Usuario } from '../../database/entities/Usuario.entity';
import { TypedRequest, getClientIp, getUserAgent } from '../../common/types/request.types';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Criar novo pedido com verificação de estoque' })
  @ApiResponse({
    status: 201,
    description: 'Pedido criado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Estoque insuficiente ou dados inválidos',
  })
  @ApiResponse({
    status: 409,
    description: 'Pedido duplicado (idempotência)',
  })
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
    @Request() req: TypedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(
      createOrderDto,
      tenantId,
      user.id,
      idempotencyKey,
      getClientIp(req),
      getUserAgent(req),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Listar pedidos',
    description: 'Lista pedidos com paginação opcional. Sem parâmetros de paginação, retorna todos os pedidos (compatibilidade).',
  })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.ordersService.findAll(tenantId, pagination);
  }

  @Get('reports/sales')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Relatorio de vendas' })
  getSalesReport(@CurrentTenant() tenantId: string) {
    return this.ordersService.getSalesReport(tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar pedido por ID' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.ordersService.findOne(id, tenantId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Atualizar status do pedido' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: PedidoStatus,
    @CurrentTenant() tenantId: string,
  ) {
    return this.ordersService.updateStatus(id, status, tenantId);
  }
}
