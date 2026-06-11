import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({ description: 'ID do tenant' })
  @IsString()
  tenantId!: string;

  @ApiProperty({ description: 'Número de telefone do cliente (somente números)' })
  @IsString()
  customerPhone!: string;

  @ApiProperty({ description: 'ID do produto' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Quantidade', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'ID do tenant' })
  @IsString()
  tenantId!: string;

  @ApiProperty({ description: 'Número de telefone do cliente' })
  @IsString()
  customerPhone!: string;

  @ApiProperty({ description: 'ID do produto no carrinho' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Nova quantidade', minimum: 0 })
  @IsNumber()
  @Min(0)
  quantity!: number;
}

export class RemoveFromCartDto {
  @ApiProperty({ description: 'ID do tenant' })
  @IsString()
  tenantId!: string;

  @ApiProperty({ description: 'Número de telefone do cliente' })
  @IsString()
  customerPhone!: string;

  @ApiProperty({ description: 'ID do produto no carrinho' })
  @IsString()
  productId!: string;
}

export class ClearCartDto {
  @ApiProperty({ description: 'ID do tenant' })
  @IsString()
  tenantId!: string;

  @ApiProperty({ description: 'Número de telefone do cliente' })
  @IsString()
  customerPhone!: string;
}

export class CartResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  customerPhone!: string;

  @ApiProperty({ description: 'Itens do carrinho' })
  items!: Array<{
    produto_id: string;
    produto_name: string;
    quantity: number;
    unit_price: number;
  }>;

  @ApiProperty()
  subtotal!: number;

  @ApiPropertyOptional()
  couponCode?: string | null;

  @ApiProperty()
  discountAmount!: number;

  @ApiProperty()
  shippingAmount!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class CartSummaryResponseDto {
  @ApiProperty()
  hasCart!: boolean;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty()
  totalValue!: number;

  @ApiProperty()
  expired!: boolean;

  @ApiPropertyOptional()
  formattedSummary?: string;
}