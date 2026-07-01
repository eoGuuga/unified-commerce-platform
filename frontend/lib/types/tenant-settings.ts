/**
 * Types da tela de Configuracoes da Loja (frente feat/tenant-config).
 *
 * Espelham o contrato do backend (T3/T4):
 *  - GET /tenants/settings  -> TenantSettingsProjection (projecao allow-list, §2.1 do spec)
 *  - PATCH /tenants/settings -> UpdateTenantSettingsDto (por secao, tudo opcional, §2.2)
 *
 * Fonte canonica do backend:
 *  - projecao: backend/src/modules/tenants/tenants.service.ts (TenantSettingsProjection)
 *  - horario:  backend/src/modules/whatsapp/utils/business-hours.ts (BusinessHours/DayHours)
 */

/** Faixa de horario de um dia. `open`/`close` em "HH:MM". */
export interface DayHours {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

/**
 * Horario de funcionamento estruturado (fonte unica de horario).
 * `days`: mapa por dia da semana, chave "0".."6" (0=domingo). Dia AUSENTE = FECHADO.
 */
export interface BusinessHours {
  tz: string; // IANA (ex.: "America/Sao_Paulo")
  days: { [dow: string]: DayHours }; // "0".."6"; ausente = fechado
}

/** Formas de pagamento aceitas (enum do backend). */
export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito';

/**
 * Projecao allow-list retornada pelo GET /tenants/settings (§2.1).
 * Campos ausentes vem como null/[]. `status` sinaliza presenca — nunca expoe o valor.
 */
export interface TenantSettingsProjection {
  loja: {
    store_name: string | null;
    tagline: string | null;
    description: string | null;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string | null;
  };
  horario: {
    business_hours: BusinessHours | null;
  };
  pagamento: {
    metodos: string[];
    pix_key: string | null;
    pix_merchant_name: string | null;
  };
  status: {
    hasBusinessHours: boolean;
    hasPixKey: boolean;
    hasPixMerchantName: boolean;
    hasWhatsappNumber: boolean;
  };
}

/**
 * Corpo do PATCH /tenants/settings (§2.2): por secao, cada campo opcional.
 * Secao ausente = nao toca; campo ausente na secao = nao toca.
 */
export interface UpdateTenantSettingsDto {
  loja?: {
    store_name?: string;
    tagline?: string;
    description?: string;
    logo_url?: string;
    favicon_url?: string;
    primary_color?: string;
  };
  horario?: {
    business_hours?: BusinessHours | null;
  };
  pagamento?: {
    metodos?: PaymentMethod[];
    pix_key?: string;
    pix_merchant_name?: string;
  };
}
