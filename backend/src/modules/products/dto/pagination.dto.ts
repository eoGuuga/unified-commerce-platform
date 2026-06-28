import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para paginação de resultados
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Número da página (começa em 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Número de itens por página',
    example: 50,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  /**
   * Quando 'true', inclui produtos inativos na listagem (uso exclusivo do admin).
   * Mantido no DTO de paginação para que o ValidationPipe (forbidNonWhitelisted)
   * não rejeite o parâmetro como desconhecido.
   */
  @ApiPropertyOptional({
    description: 'Incluir produtos inativos na listagem (somente admin)',
    example: 'true',
  })
  @IsOptional()
  @IsString()
  include_inactive?: string;
}
