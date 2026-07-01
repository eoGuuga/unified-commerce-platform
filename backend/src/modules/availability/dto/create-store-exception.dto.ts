import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoreExceptionKind } from '../../../database/entities/StoreAvailabilityException.entity';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validacao CRUZADA open/close × kind — espelha o CHECK `chk_exception_hours`
 * da tabela (Camada 1: `IsBusinessHours`). Fail-closed:
 *  - kind = 'closed'       -> open E close DEVEM estar ausentes (proibidos);
 *  - kind = 'custom_hours' -> open E close DEVEM estar presentes (obrigatorios).
 */
@ValidatorConstraint({ name: 'exceptionHoursMatchKind', async: false })
export class ExceptionHoursMatchKindConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateStoreExceptionDto;
    const hasOpen = dto.open !== undefined && dto.open !== null;
    const hasClose = dto.close !== undefined && dto.close !== null;

    if (dto.kind === StoreExceptionKind.CLOSED) {
      // `closed` nao pode ter open/close.
      return !hasOpen && !hasClose;
    }
    if (dto.kind === StoreExceptionKind.CUSTOM_HOURS) {
      // `custom_hours` exige ambos.
      return hasOpen && hasClose;
    }
    // kind invalido cai no @IsEnum; aqui nao restringe.
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateStoreExceptionDto;
    if (dto.kind === StoreExceptionKind.CLOSED) {
      return "kind 'closed' nao aceita open/close (deve ser dia inteiro fechado)";
    }
    return "kind 'custom_hours' exige open e close (HH:MM)";
  }
}

/**
 * Rejeita `date` no PASSADO (R4). "Hoje" e comparado no fuso da loja
 * (America/Sao_Paulo, default) para nao rejeitar hoje por diferenca de fuso do
 * servidor. Loja so entra no dia corrente pelo atalho "fechar hoje". A data
 * exata do fuso do TENANT e re-checada no service (fonte de verdade); este
 * validator e o primeiro portao, tolerante ao fuso da loja.
 */
@ValidatorConstraint({ name: 'notPastDate', async: false })
export class NotPastDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !YYYY_MM_DD.test(value)) {
      return true; // formato invalido cai no @Matches.
    }
    // "Hoje" no fuso da loja (America/Sao_Paulo) — comparacao lexicografica de
    // 'YYYY-MM-DD' equivale a comparacao cronologica.
    const todayStoreTz = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return value >= todayStoreTz;
  }

  defaultMessage(): string {
    return 'date nao pode estar no passado (exceçao retroativa nao faz sentido)';
  }
}

/**
 * DTO de criaçao de exceçao de disponibilidade (Camada 2).
 * `date` = data civil no fuso da loja (YYYY-MM-DD), nao-passado (R4).
 * `open`/`close` = HH:MM; obrigatorios se custom_hours, proibidos se closed.
 */
export class CreateStoreExceptionDto {
  @ApiProperty({ example: '2026-12-25', description: 'Data civil (YYYY-MM-DD), nao-passado' })
  @IsString()
  @Matches(YYYY_MM_DD, { message: 'date deve ser YYYY-MM-DD' })
  @Validate(NotPastDateConstraint)
  date: string;

  @ApiProperty({ enum: StoreExceptionKind, example: StoreExceptionKind.CLOSED })
  @IsEnum(StoreExceptionKind, { message: "kind deve ser 'closed' ou 'custom_hours'" })
  @Validate(ExceptionHoursMatchKindConstraint)
  kind: StoreExceptionKind;

  @ApiPropertyOptional({ example: '09:00', description: 'HH:MM — obrigatorio em custom_hours' })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'open deve ser HH:MM' })
  open?: string;

  @ApiPropertyOptional({ example: '13:00', description: 'HH:MM — obrigatorio em custom_hours' })
  @IsOptional()
  @IsString()
  @Matches(HHMM, { message: 'close deve ser HH:MM' })
  close?: string;
}
