import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendConfirmationDto {
  @ApiProperty({ example: 'usuario@email.com', description: 'Email para envio do codigo' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;
}

export class ConfirmEmailDto {
  @ApiProperty({ example: 'usuario@email.com', description: 'Email do usuario' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Codigo de confirmacao de 6 digitos' })
  @IsString()
  @Length(6, 6, { message: 'Codigo deve ter 6 digitos' })
  code: string;
}