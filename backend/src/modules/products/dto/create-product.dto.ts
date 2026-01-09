import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'ID da categoria do produto' })
  @IsOptional()
  @IsString()
  categoria_id?: string;

  @ApiProperty({ description: 'SKU do produto' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ description: 'Nome do produto', example: 'Brigadeiro Gourmet' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Descrição do produto', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Preço de venda', example: 10.5 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Preço de custo', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @ApiProperty({ description: 'Unidade de medida', example: 'unidade', default: 'unidade' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ description: 'Produto ativo?', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ description: 'Metadata adicional (imagens, tags, etc)', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}
