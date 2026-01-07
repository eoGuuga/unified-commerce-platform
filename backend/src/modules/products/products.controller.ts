import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Usuario } from '../../database/entities/Usuario.entity';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar todos os produtos' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.productsService.findAll(tenantId);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar produtos por nome/descrição' })
  search(@Query('q') query: string, @CurrentTenant() tenantId: string) {
    return this.productsService.search(tenantId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar produto por ID' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.productsService.findOne(id, tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Criar novo produto' })
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
    @Request() req: any,
  ) {
    return this.productsService.create(
      createProductDto,
      tenantId,
      user?.id,
      req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      req.headers['user-agent'],
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Atualizar produto' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
    @Request() req: any,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      tenantId,
      user?.id,
      req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      req.headers['user-agent'],
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Desativar produto (soft delete)' })
  remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
    @Request() req: any,
  ) {
    return this.productsService.remove(
      id,
      tenantId,
      user?.id,
      req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      req.headers['user-agent'],
    );
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reservar estoque (adicionar ao carrinho)' })
  reserveStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @CurrentTenant() tenantId: string,
  ) {
    return this.productsService.reserveStock(id, quantity || 1, tenantId);
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Liberar estoque reservado (remover do carrinho)' })
  releaseStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @CurrentTenant() tenantId: string,
  ) {
    return this.productsService.releaseStock(id, quantity || 1, tenantId);
  }

  @Get('stock-summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obter resumo completo de estoque (para página de gestão)' })
  @ApiResponse({ status: 200, description: 'Resumo de estoque retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getStockSummary(@CurrentTenant() tenantId: string) {
    return this.productsService.getStockSummary(tenantId);
  }

  @Post(':id/adjust-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ajustar estoque (adicionar ou remover quantidade)' })
  @ApiResponse({ status: 200, description: 'Estoque ajustado com sucesso' })
  @ApiResponse({ status: 400, description: 'Quantidade inválida ou estoque insuficiente' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  adjustStock(
    @Param('id') id: string,
    @Body() adjustStockDto: { quantity: number; reason?: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    return this.productsService.adjustStock(
      id,
      adjustStockDto.quantity,
      tenantId,
      adjustStockDto.reason,
      user?.id,
      req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      req.headers['user-agent'],
    );
  }

  @Patch(':id/min-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Definir estoque mínimo (alerta)' })
  @ApiResponse({ status: 200, description: 'Estoque mínimo definido com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  setMinStock(
    @Param('id') id: string,
    @Body('min_stock') minStock: number,
    @CurrentTenant() tenantId: string,
  ) {
    return this.productsService.setMinStock(id, minStock, tenantId);
  }
}
