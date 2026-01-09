import { IsOptional, IsString, Length } from 'class-validator';

export class UpsertDevCouponDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  code?: string;
}

