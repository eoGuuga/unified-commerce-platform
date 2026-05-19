import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Padaria do Joao', description: 'Nome da empresa' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  company_name: string;

  @ApiProperty({ example: 'padaria-do-joao', description: 'Slug unico (URL-friendly)' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug deve conter apenas letras minusculas, numeros e hifens (ex: minha-empresa)',
  })
  slug: string;

  @ApiProperty({ example: 'joao@padaria.com', description: 'Email do administrador' })
  @IsEmail()
  admin_email: string;

  @ApiProperty({ example: 'senhaSegura123', description: 'Senha do administrador (min 8 chars)' })
  @IsString()
  @MinLength(8)
  admin_password: string;

  @ApiProperty({ example: 'Joao Silva', description: 'Nome completo do administrador', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  admin_name?: string;

  @ApiProperty({ example: '11999998888', description: 'Telefone do administrador', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  admin_phone?: string;
}
