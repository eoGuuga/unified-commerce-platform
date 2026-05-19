import { IsString, IsOptional, MaxLength, Matches, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBrandingDto {
  @ApiProperty({ example: 'https://cdn.example.com/logo.png', required: false })
  @IsOptional()
  @IsUrl({}, { message: 'logo_url deve ser uma URL valida' })
  logo_url?: string;

  @ApiProperty({ example: '#10b981', description: 'Cor primaria em hex', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primary_color deve ser hex valido (ex: #10b981)' })
  primary_color?: string;

  @ApiProperty({ example: 'Padaria do Joao', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  store_name?: string;

  @ApiProperty({ example: 'Os melhores paes artesanais da cidade', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline?: string;

  @ApiProperty({ example: 'https://cdn.example.com/favicon.ico', required: false })
  @IsOptional()
  @IsUrl({}, { message: 'favicon_url deve ser uma URL valida' })
  favicon_url?: string;
}
