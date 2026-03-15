import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class TrackPublicOrderDto {
  @ApiProperty({
    description: 'Codigo do pedido informado ao cliente',
    example: 'PED-20260315-A1B2',
  })
  @IsString()
  @Length(6, 50)
  order_no: string;

  @ApiProperty({
    description: 'Email usado na compra',
    required: false,
    example: 'cliente@exemplo.com',
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  customer_email?: string;

  @ApiProperty({
    description: 'Telefone usado na compra',
    required: false,
    example: '11999999999',
  })
  @IsOptional()
  @IsString()
  @Length(4, 20)
  customer_phone?: string;
}
