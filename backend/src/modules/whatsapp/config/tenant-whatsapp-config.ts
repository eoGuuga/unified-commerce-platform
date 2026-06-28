/**
 * Configuracao de WhatsApp POR TENANT (agnostica de provider).
 *
 * Cada cliente do SaaS conecta o proprio canal de WhatsApp. Esta abstracao
 * descreve "como este tenant envia mensagens" — qual provider e quais
 * credenciais — para que o restante do codigo nao dependa de um provider fixo
 * nem de credenciais globais de ambiente.
 *
 * Provider preferido: `cloud_api` (WhatsApp Business Cloud API oficial da Meta).
 * `evolution` mantido por compatibilidade, mas DESCARTADO para novos clientes
 * (risco de ban — API nao-oficial). `mock` para dev/teste.
 */
export type WhatsappProviderKind = 'cloud_api' | 'evolution' | 'twilio' | 'mock';

/** Credenciais da Cloud API oficial (Meta). O accessToken e segredo. */
export interface CloudApiCredentials {
  /** ID do numero de telefone na Meta (nao-secreto). */
  phoneNumberId: string;
  /** Access token permanente do app/numero (SEGREDO — criptografado em repouso). */
  accessToken: string;
  /** Versao da Graph API (ex.: 'v21.0'). Default razoavel se ausente. */
  apiVersion?: string;
}

/** Credenciais da Evolution API (legado/nao-oficial). apiKey e segredo. */
export interface EvolutionCredentials {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

/** Credenciais do Twilio (legado). authToken e segredo. */
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Config resolvida de um tenant. Exatamente UM bloco de credenciais
 * estara preenchido, conforme `provider`.
 */
export interface TenantWhatsappConfig {
  tenantId: string;
  provider: WhatsappProviderKind;
  cloudApi?: CloudApiCredentials;
  evolution?: EvolutionCredentials;
  twilio?: TwilioCredentials;
}

/** Versao default da Graph API quando o tenant nao especifica. */
export const DEFAULT_CLOUD_API_VERSION = 'v21.0';

/**
 * Indica se a config tem credenciais suficientes para enviar.
 * `mock` sempre pode (so loga).
 */
export function isWhatsappConfigUsable(config: TenantWhatsappConfig): boolean {
  switch (config.provider) {
    case 'mock':
      return true;
    case 'cloud_api':
      return Boolean(config.cloudApi?.phoneNumberId && config.cloudApi?.accessToken);
    case 'evolution':
      return Boolean(config.evolution?.apiUrl && config.evolution?.apiKey);
    case 'twilio':
      return Boolean(
        config.twilio?.accountSid && config.twilio?.authToken && config.twilio?.fromNumber,
      );
    default:
      return false;
  }
}
