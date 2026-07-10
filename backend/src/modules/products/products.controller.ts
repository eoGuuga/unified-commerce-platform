import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  Delete,
  Query,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Usuario } from '../../database/entities/Usuario.entity';
import { TypedRequest, getClientIp, getUserAgent } from '../../common/types/request.types';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('public/catalog')
  @ApiOperation({ summary: 'Catalogo publico da loja' })
  getPublicCatalog(@Headers('x-tenant-id') tenantId: string) {
    return this.productsService.findAll(tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Listar produtos',
    description: 'Lista produtos com paginação opcional. Sem parâmetros de paginação, retorna todos os produtos (compatibilidade). Passar include_inactive=true retorna também produtos inativos (uso exclusivo do admin).',
  })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationDto,
    @Query('include_inactive') includeInactiveRaw: string,
    @Request() req: TypedRequest,
  ) {
    const hasPagination =
      typeof req?.query?.page !== 'undefined' || typeof req?.query?.limit !== 'undefined';
    const includeInactive = includeInactiveRaw === 'true';
    return this.productsService.findAll(tenantId, hasPagination ? pagination : undefined, includeInactive);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar produtos por nome/descrição' })
  search(@Query('q') query: string, @CurrentTenant() tenantId: string) {
    return this.productsService.search(tenantId, query);
  }

  @Get('stock-summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obter resumo completo de estoque (para página de gestão)' })
  @ApiResponse({ status: 200, description: 'Resumo de estoque retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getStockSummary(@CurrentTenant() tenantId: string) {
    return this.productsService.getStockSummary(tenantId);
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retorna categorias DISTINCT dos produtos do tenant' })
  @ApiResponse({ status: 200, description: 'Lista de categorias' })
  getCategories(@CurrentTenant() tenantId: string) {
    return this.productsService.getCategories(tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar produto por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() tenantId: string) {
    return this.productsService.findOne(id, tenantId);
  }

  @Get(':id/stock-history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Extrato paginado de movimentações de estoque do produto' })
  @ApiResponse({ status: 200, description: 'Extrato retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  getStockHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.productsService.getStockHistory(
      id,
      tenantId,
      Number(limit) || 50,
      Number(offset) || 0,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Criar novo produto' })
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
    @Request() req: TypedRequest,
  ) {
    return this.productsService.create(
      createProductDto,
      tenantId,
      user?.id,
      getClientIp(req),
      getUserAgent(req),
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
    @Request() req: TypedRequest,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      tenantId,
      user?.id,
      getClientIp(req),
      getUserAgent(req),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Desativar produto (soft delete)' })
  remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
    @Request() req: TypedRequest,
  ) {
    return this.productsService.remove(
      id,
      tenantId,
      user?.id,
      getClientIp(req),
      getUserAgent(req),
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

  @Post(':id/adjust-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ajustar estoque via ledger (COMPRA/PERDA/DEVOLUCAO/AJUSTE)' })
  @ApiResponse({ status: 201, description: 'Estoque ajustado com sucesso via ledger' })
  @ApiResponse({ status: 400, description: 'Tipo ou sinal inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  @ApiResponse({ status: 422, description: 'Estoque insuficiente (INSUFFICIENT_STOCK)' })
  adjustStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
  ) {
    return this.productsService.adjustStockLedger(
      id,
      dto.tipo as unknown as any,
      dto.delta,
      dto.motivo ?? null,
      tenantId,
      user?.id ?? null,
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
