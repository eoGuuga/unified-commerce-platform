import { IsEnum, IsInt, IsOptional, IsString, NotEquals } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AdjustStockTipo {
  COMPRA = 'COMPRA',
  PERDA = 'PERDA',
  DEVOLUCAO = 'DEVOLUCAO',
  AJUSTE = 'AJUSTE',
}

export class AdjustStockDto {
  @ApiProperty({ enum: AdjustStockTipo, description: 'Tipo de movimento manual (INVENTARIO_INICIAL nao e aceito no wire)' })
  @IsEnum(AdjustStockTipo)
  tipo: AdjustStockTipo;

  @ApiProperty({ description: 'Delta sinalizado (+ entrada / - saida)' })
  @IsInt()
  @NotEquals(0)
  delta: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motivo?: string;
}
