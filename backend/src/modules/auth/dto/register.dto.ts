import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsBoolean,
  Equals,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'usuario@exemplo.com' })
  @IsEmail()
  email: string;

  // Politica de senha: min 8, ao menos uma letra e um numero, max 72 (bcrypt
  // trunca acima de 72 bytes — rejeitar em vez de truncar silenciosamente).
  @ApiProperty({ example: 'senha1234', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no maximo 72 caracteres.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'A senha deve conter ao menos uma letra e um numero.',
  })
  password: string;

  @ApiProperty({ example: 'Joao Silva', required: false })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({ example: '11999999999', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  // NOTA DE SEGURANCA: NAO existe campo `role` aqui de proposito. O role nunca
  // vem do cliente (evita auto-registro como admin); todo auto-registro nasce
  // SELLER no servico. Com whitelist+forbidNonWhitelisted, mandar `role` no body
  // e rejeitado (400). Elevacao de privilegio so por fluxo administrativo.

  // Consentimento LGPD obrigatorio (Art. 7/8): registro exige aceite explicito.
  @ApiProperty({
    example: true,
    description: 'Aceite dos Termos de Uso e Politica de Privacidade. Obrigatorio.',
  })
  @IsBoolean()
  @Equals(true, { message: 'E necessario aceitar os Termos de Uso e a Politica de Privacidade.' })
  accept_terms: boolean;
}
