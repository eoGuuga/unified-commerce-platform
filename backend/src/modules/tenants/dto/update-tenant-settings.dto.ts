import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsUrl,
  IsObject,
  IsArray,
  IsEnum,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BusinessHours } from '../../whatsapp/utils/business-hours';

/**
 * Metodos de pagamento aceitos (allow-list fechada). `metodos` deve ser
 * um subconjunto deste enum — qualquer valor fora dele e rejeitado (400).
 */
export enum PaymentMethod {
  PIX = 'pix',
  DINHEIRO = 'dinheiro',
  DEBITO = 'debito',
  CREDITO = 'credito',
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validacao FAIL-CLOSED do shape de business_hours, espelhando `getBusinessHours`
 * do whatsapp.service (fonte unica do shape por-dia). Rejeita:
 *  - nao-objeto, `tz` ausente/vazio, `days` ausente/nao-objeto/array;
 *  - qualquer chave de `days` fora de "0".."6";
 *  - qualquer `open`/`close` fora de "HH:MM";
 *  - mapa sem nenhum dia valido.
 *
 * `business_hours: null` e ACEITO (limpar horario). `undefined` (ausente) tambem
 * — o @IsOptional cuida disso antes de chegar aqui.
 */
@ValidatorConstraint({ name: 'isBusinessHours', async: false })
export class IsBusinessHoursConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null) {
      return true; // limpar horario e valido
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const bh = value as { tz?: unknown; days?: unknown };
    if (typeof bh.tz !== 'string' || bh.tz.length === 0) {
      return false;
    }
    if (!bh.days || typeof bh.days !== 'object' || Array.isArray(bh.days)) {
      return false;
    }
    const entries = Object.entries(bh.days as Record<string, unknown>);
    // Fail-closed: pelo menos um dia; nenhuma chave/faixa invalida.
    if (entries.length === 0) {
      return false;
    }
    for (const [dow, dh] of entries) {
      if (!/^[0-6]$/.test(dow)) {
        return false;
      }
      const d = dh as { open?: unknown; close?: unknown } | null;
      if (
        !d ||
        typeof d !== 'object' ||
        typeof d.open !== 'string' ||
        typeof d.close !== 'string' ||
        !HHMM.test(d.open) ||
        !HHMM.test(d.close)
      ) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return 'business_hours invalido: shape esperado { tz, days: { "0".."6": { open:"HH:MM", close:"HH:MM" } } }';
  }
}

/** Secao Loja (branding + descricao). Todos os campos opcionais. */
export class UpdateLojaSectionDto {
  @ApiPropertyOptional({ example: 'Padaria do Joao' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  store_name?: string;

  @ApiPropertyOptional({ example: 'Os melhores paes da cidade' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tagline?: string;

  @ApiPropertyOptional({ example: 'Padaria artesanal desde 1990.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl({}, { message: 'logo_url deve ser uma URL valida' })
  logo_url?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/favicon.ico' })
  @IsOptional()
  @IsUrl({}, { message: 'favicon_url deve ser uma URL valida' })
  favicon_url?: string;

  @ApiPropertyOptional({ example: '#10b981', description: 'Cor primaria em hex #RRGGBB' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primary_color deve ser hex #RRGGBB (ex: #10b981)' })
  primary_color?: string;
}

/** Secao Horario. `business_hours` = shape por-dia (fonte unica) ou null (limpar). */
export class UpdateHorarioSectionDto {
  @ApiPropertyOptional({
    description: 'Horario por-dia { tz, days: { "0".."6": { open, close } } }, ou null para limpar',
  })
  @IsOptional()
  @Validate(IsBusinessHoursConstraint)
  business_hours?: BusinessHours | null;
}

/** Secao Pagamento. `metodos` ⊂ PaymentMethod. */
export class UpdatePagamentoSectionDto {
  @ApiPropertyOptional({ enum: PaymentMethod, isArray: true, example: ['pix', 'dinheiro'] })
  @IsOptional()
  @IsArray()
  @IsEnum(PaymentMethod, {
    each: true,
    message: 'metodos deve conter apenas: pix, dinheiro, debito, credito',
  })
  metodos?: PaymentMethod[];

  @ApiPropertyOptional({ example: 'loja@pix.com' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  pix_key?: string;

  @ApiPropertyOptional({ example: 'Padaria do Joao LTDA' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  pix_merchant_name?: string;
}

/**
 * DTO por SECAO (§2.2). Cada secao e opcional; cada campo dentro dela e opcional.
 * Secao AUSENTE = nao toca (o service so mescla as secoes presentes).
 */
export class UpdateTenantSettingsDto {
  @ApiProperty({ type: UpdateLojaSectionDto, required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateLojaSectionDto)
  loja?: UpdateLojaSectionDto;

  @ApiProperty({ type: UpdateHorarioSectionDto, required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateHorarioSectionDto)
  horario?: UpdateHorarioSectionDto;

  @ApiProperty({ type: UpdatePagamentoSectionDto, required: false })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdatePagamentoSectionDto)
  pagamento?: UpdatePagamentoSectionDto;
}
