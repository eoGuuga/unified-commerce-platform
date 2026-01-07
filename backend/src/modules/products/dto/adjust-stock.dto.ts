import { IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({ description: 'Quantidade a ajustar (positivo para adicionar, negativo para remover)', example: 10 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Motivo do ajuste', required: false, example: 'Reposição de estoque' })
  @IsOptional()
  @IsString()
  reason?: string;
}
