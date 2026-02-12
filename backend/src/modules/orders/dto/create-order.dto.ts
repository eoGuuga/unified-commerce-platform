import {
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsUUID,
  Min,
  Length,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CanalVenda } from '../../../database/entities/Pedido.entity';

export class DeliveryAddressDto {
  @IsString()
  street: string;

  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  neighborhood: string;

  @IsString()
  city: string;

  @IsString()
  @Length(2, 2)
  state: string;

  @IsString()
  zipcode: string;
}

export class CreateOrderItemDto {
  @ApiProperty({ description: 'ID do produto' })
  @IsUUID()
  produto_id: string;

  @ApiProperty({ description: 'Quantidade', example: 5, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Preço unitário no momento da venda', example: 10.5 })
  @IsNumber()
  @Min(0)
  unit_price: number;
}

export class CreateOrderDto {
  @ApiProperty({ 
    description: 'Canal de venda',
    enum: CanalVenda,
    example: 'pdv' 
  })
  @IsEnum(CanalVenda)
  channel: CanalVenda;

  @ApiProperty({ description: 'Dados do cliente', required: false })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiProperty({ description: 'Email do cliente', required: false })
  @IsOptional()
  @IsString()
  customer_email?: string;

  @ApiProperty({ description: 'Telefone do cliente', required: false })
  @IsOptional()
  @IsString()
  customer_phone?: string;

  @ApiProperty({ description: 'Observacoes do cliente', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  customer_notes?: string;

  @ApiProperty({ description: 'Tipo de entrega (delivery/pickup)', required: false })
  @IsOptional()
  @IsString()
  delivery_type?: string;

  @ApiProperty({ description: 'Endereco de entrega', required: false, type: DeliveryAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery_address?: DeliveryAddressDto;

  @ApiProperty({ 
    description: 'Itens do pedido',
    type: [CreateOrderItemDto] 
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({ description: 'Valor de desconto', default: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @ApiProperty({ description: 'Codigo do cupom aplicado', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  coupon_code?: string;

  @ApiProperty({ description: 'Valor de frete', default: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping_amount?: number;
}
