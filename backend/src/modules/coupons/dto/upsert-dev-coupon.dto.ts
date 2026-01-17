import { IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { TipoDesconto } from '../../../database/entities/CupomDesconto.entity';

export class UpsertDevCouponDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  code?: string;

  @IsOptional()
  @IsEnum(TipoDesconto)
  discount_type?: TipoDesconto;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount_value?: number;
}

