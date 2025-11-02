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

@ApiTags('Products')
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
  @ApiOperation({ summary: 'Criar novo produto' })
  create(@Body() createProductDto: CreateProductDto, @Query('tenantId') tenantId: string) {
    return this.productsService.create(createProductDto, tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar produto' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Query('tenantId') tenantId: string,
  ) {
    return this.productsService.update(id, updateProductDto, tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desativar produto (soft delete)' })
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.productsService.remove(id, tenantId || '00000000-0000-0000-0000-000000000000');
  }
}
