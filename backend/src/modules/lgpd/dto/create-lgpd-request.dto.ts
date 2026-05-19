import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LgpdRequestType {
  ACCESS = 'access',
  CORRECTION = 'correction',
  DELETION = 'deletion',
  PORTABILITY = 'portability',
  REVOCATION = 'revocation',
}

export enum LgpdRequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DENIED = 'denied',
}

export class CreateLgpdRequestDto {
  @ApiProperty({
    enum: LgpdRequestType,
    example: LgpdRequestType.ACCESS,
    description: 'Tipo de solicitacao conforme Art. 18 da LGPD',
  })
  @IsEnum(LgpdRequestType)
  type: LgpdRequestType;

  @ApiProperty({
    example: 'Gostaria de receber uma copia de todos os meus dados pessoais.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
