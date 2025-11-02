import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PedidoStatus } from '../../database/entities/Pedido.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo pedido com verificação de estoque' })
  @ApiResponse({
    status: 201,
    description: 'Pedido criado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Estoque insuficiente ou dados inválidos',
  })
  create(@Body() createOrderDto: CreateOrderDto, @Query('tenantId') tenantId: string) {
    return this.ordersService.create(
      createOrderDto,
      tenantId || '00000000-0000-0000-0000-000000000000',
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os pedidos' })
  findAll(@Query('tenantId') tenantId: string) {
    return this.ordersService.findAll(tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar pedido por ID' })
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.ordersService.findOne(
      id,
      tenantId || '00000000-0000-0000-0000-000000000000',
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status do pedido' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: PedidoStatus,
    @Query('tenantId') tenantId: string,
  ) {
    return this.ordersService.updateStatus(
      id,
      status,
      tenantId || '00000000-0000-0000-0000-000000000000',
    );
  }
}
