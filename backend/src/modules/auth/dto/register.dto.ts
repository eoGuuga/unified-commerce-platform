import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsBoolean,
  Equals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/Usuario.entity';

export class RegisterDto {
  @ApiProperty({ example: 'usuario@exemplo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Joao Silva', required: false })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({ example: '11999999999', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // Consentimento LGPD obrigatorio (Art. 7/8): registro exige aceite explicito.
  @ApiProperty({
    example: true,
    description: 'Aceite dos Termos de Uso e Politica de Privacidade. Obrigatorio.',
  })
  @IsBoolean()
  @Equals(true, { message: 'E necessario aceitar os Termos de Uso e a Politica de Privacidade.' })
  accept_terms: boolean;
}
