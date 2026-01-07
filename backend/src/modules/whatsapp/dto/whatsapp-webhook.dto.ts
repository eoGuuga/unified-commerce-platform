import { IsString, IsOptional, IsObject } from 'class-validator';

/**
 * DTO para webhook do WhatsApp
 */
export class WhatsappWebhookDto {
  @IsString()
  from: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
