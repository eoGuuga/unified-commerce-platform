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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os produtos' })
  findAll(@Query('tenantId') tenantId: string) {
    return this.productsService.findAll(tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar produtos por nome/descrição' })
  search(@Query('q') query: string, @Query('tenantId') tenantId: string) {
    return this.productsService.search(tenantId || '00000000-0000-0000-0000-000000000000', query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar produto por ID' })
  findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.productsService.findOne(id, tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Criar novo produto' })
  create(@Body() createProductDto: CreateProductDto, @Query('tenantId') tenantId: string) {
    return this.productsService.create(createProductDto, tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Atualizar produto' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Query('tenantId') tenantId: string,
  ) {
    return this.productsService.update(id, updateProductDto, tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Desativar produto (soft delete)' })
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.productsService.remove(id, tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reservar estoque (adicionar ao carrinho)' })
  reserveStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @Query('tenantId') tenantId: string,
  ) {
    return this.productsService.reserveStock(
      id,
      quantity || 1,
      tenantId || '00000000-0000-0000-0000-000000000000',
    );
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Liberar estoque reservado (remover do carrinho)' })
  releaseStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @Query('tenantId') tenantId: string,
  ) {
    return this.productsService.releaseStock(
      id,
      quantity || 1,
      tenantId || '00000000-0000-0000-0000-000000000000',
    );
  }

  @Get('stock-summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obter resumo completo de estoque (para página de gestão)' })
  getStockSummary(@Query('tenantId') tenantId: string) {
    return this.productsService.getStockSummary(tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Post(':id/adjust-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ajustar estoque (adicionar ou remover quantidade)' })
  adjustStock(
    @Param('id') id: string,
    @Body() adjustStockDto: { quantity: number; reason?: string },
    @Query('tenantId') tenantId: string,
  ) {
    return this.productsService.adjustStock(
      id,
      adjustStockDto.quantity,
      tenantId || '00000000-0000-0000-0000-000000000000',
      adjustStockDto.reason,
    );
  }

  @Patch(':id/min-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Definir estoque mínimo (alerta)' })
  setMinStock(
    @Param('id') id: string,
    @Body('min_stock') minStock: number,
    @Query('tenantId') tenantId: string,
  ) {
    return this.productsService.setMinStock(id, minStock, tenantId || '00000000-0000-0000-0000-000000000000');
  }
}
