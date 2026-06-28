import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantsService } from '../../tenants/tenants.service';
import { EncryptionService } from '../../common/services/encryption.service';
import {
  TenantWhatsappConfig,
  WhatsappProviderKind,
  DEFAULT_CLOUD_API_VERSION,
} from './tenant-whatsapp-config';

/**
 * Resolve a configuracao de WhatsApp de um tenant (qual provider + credenciais).
 *
 * Ordem de resolucao:
 * 1. Le `tenant.settings.whatsapp` (provider escolhido + dados nao-secretos).
 * 2. Descriptografa o segredo do provider (ex.: access token da Cloud API).
 * 3. FALLBACK: se o tenant nao configurou nada proprio, usa as credenciais
 *    GLOBAIS de ambiente (comportamento atual) — assim nada quebra na transicao.
 *
 * Cache curto em memoria por tenant para evitar descriptografar a cada mensagem.
 */
@Injectable()
export class WhatsappConfigResolver {
  private readonly logger = new Logger(WhatsappConfigResolver.name);
  private readonly cache = new Map<string, { config: TenantWhatsappConfig; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly encryptionService: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  /** Limpa o cache de um tenant (chamar quando as credenciais mudam). */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  async resolve(tenantId: string): Promise<TenantWhatsappConfig> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > this.now()) {
      return cached.config;
    }

    const config = await this.resolveUncached(tenantId);
    this.cache.set(tenantId, { config, expiresAt: this.now() + this.CACHE_TTL_MS });
    return config;
  }

  private async resolveUncached(tenantId: string): Promise<TenantWhatsappConfig> {
    let whatsappSettings: Record<string, unknown> = {};
    try {
      const tenant = await this.tenantsService.findOneById(tenantId);
      whatsappSettings = (tenant.settings?.whatsapp as Record<string, unknown>) || {};
    } catch (error) {
      // Tenant nao encontrado/erro -> cai no fallback global (nao explode o envio).
      this.logger.warn('Falha ao carregar settings do tenant; usando fallback global', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const tenantProvider = (whatsappSettings.provider as WhatsappProviderKind) || null;

    // --- Caminho 1: tenant tem provider proprio configurado ---
    if (tenantProvider === 'cloud_api') {
      const phoneNumberId = String(whatsappSettings.phoneNumberId || '');
      const apiVersion = String(whatsappSettings.apiVersion || DEFAULT_CLOUD_API_VERSION);
      let accessToken = '';
      try {
        accessToken = (await this.encryptionService.getWhatsappCloudToken(tenantId)) || '';
      } catch (error) {
        this.logger.error('Falha ao descriptografar token Cloud API do tenant', {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return {
        tenantId,
        provider: 'cloud_api',
        cloudApi: { phoneNumberId, accessToken, apiVersion },
      };
    }

    if (tenantProvider === 'evolution') {
      return {
        tenantId,
        provider: 'evolution',
        evolution: {
          apiUrl: String(whatsappSettings.apiUrl || ''),
          apiKey: String(whatsappSettings.apiKey || ''),
          instance: String(whatsappSettings.instance || 'default'),
        },
      };
    }

    // --- Caminho 2 (FALLBACK): credenciais globais de ambiente ---
    return this.resolveFromGlobalEnv(tenantId);
  }

  /**
   * Fallback de compatibilidade: usa as credenciais globais do .env
   * (comportamento atual antes do per-tenant). Permite a transicao gradual.
   */
  private resolveFromGlobalEnv(tenantId: string): TenantWhatsappConfig {
    const globalProvider = (this.config.get<string>('WHATSAPP_PROVIDER') || 'mock').toLowerCase();

    if (globalProvider === 'cloud_api') {
      return {
        tenantId,
        provider: 'cloud_api',
        cloudApi: {
          phoneNumberId: this.config.get<string>('WHATSAPP_CLOUD_PHONE_NUMBER_ID', ''),
          accessToken: this.config.get<string>('WHATSAPP_CLOUD_ACCESS_TOKEN', ''),
          apiVersion: this.config.get<string>('WHATSAPP_CLOUD_API_VERSION', DEFAULT_CLOUD_API_VERSION),
        },
      };
    }

    if (globalProvider === 'evolution') {
      return {
        tenantId,
        provider: 'evolution',
        evolution: {
          apiUrl: this.config.get<string>('EVOLUTION_API_URL', ''),
          apiKey: this.config.get<string>('EVOLUTION_API_KEY', ''),
          instance: this.config.get<string>('EVOLUTION_INSTANCE', 'default'),
        },
      };
    }

    if (globalProvider === 'twilio') {
      return {
        tenantId,
        provider: 'twilio',
        twilio: {
          accountSid: this.config.get<string>('TWILIO_ACCOUNT_SID', ''),
          authToken: this.config.get<string>('TWILIO_AUTH_TOKEN', ''),
          fromNumber: this.config.get<string>('TWILIO_WHATSAPP_NUMBER', ''),
        },
      };
    }

    return { tenantId, provider: 'mock' };
  }

  private now(): number {
    return Date.now();
  }
}
