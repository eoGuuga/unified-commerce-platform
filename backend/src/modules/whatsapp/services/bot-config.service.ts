import { Injectable } from '@nestjs/common';
import { TenantsService } from '../../tenants/tenants.service';
import {
  BusinessHours,
  describeBusinessHours,
} from '../utils/business-hours';

export interface BotPersona {
  name: string;
  role: string;
  tone: string;
  greeting_style: string;
}

export interface BotStoreConfig {
  name: string;
  description: string;
  payment_methods: string[];
  delivery_options: string[];
  business_hours: string;
}

export interface BotConfig {
  persona: BotPersona;
  store: BotStoreConfig;
  rules: string[];
  model: string;
  temperature: number;
}

const DEFAULT_PERSONA: BotPersona = {
  name: 'Assistente',
  role: 'vendedora consultiva',
  tone: 'acolhedora, segura, objetiva, humana',
  greeting_style: 'Oi! Sou a assistente da loja no WhatsApp.',
};

const DEFAULT_STORE: BotStoreConfig = {
  name: 'Loja',
  description: 'Loja online',
  payment_methods: ['pix', 'dinheiro'],
  delivery_options: ['entrega', 'retirada'],
  // business_hours NAO tem default chumbado: horario e fonte unica
  // (settings.business_hours). Sem ele, a string fica vazia e o bot nao afirma horario.
  business_hours: '',
};

const DEFAULT_RULES: string[] = [
  'Nunca invente produtos, precos, politicas ou formas de pagamento que nao existam no catalogo real.',
  'Nunca prometa desconto sem cupom valido.',
  'Sempre confirme o pedido completo antes de criar.',
  'Se nao souber a resposta, diga que vai verificar — nunca chute.',
  'Nao force venda. Seja consultiva e ajude o cliente a decidir.',
  'Responda em no maximo 4 linhas curtas. Sem markdown, sem listas grandes.',
  'Se o cliente pedir algo fora do escopo (suporte tecnico, reclamacao grave), ofereça encaminhar para atendimento humano.',
];

@Injectable()
export class BotConfigService {
  constructor(private readonly tenantsService: TenantsService) {}

  async loadConfig(tenantId: string): Promise<BotConfig> {
    let tenant: { name: string; settings?: Record<string, any> } | null = null;

    try {
      tenant = await this.tenantsService.findOneById(tenantId);
    } catch {
      // tenant nao encontrado, usar defaults
    }

    const settings = (tenant?.settings as Record<string, any>) || {};
    const botSettings = settings.whatsapp_bot || {};

    const persona: BotPersona = {
      ...DEFAULT_PERSONA,
      ...(botSettings.persona || {}),
    };

    // Horario = FONTE UNICA: a string do prompt e derivada do objeto canonico
    // (settings.business_hours) via describeBusinessHours. Ausente/invalido -> '' (bot nao afirma horario).
    const businessHours = describeBusinessHours(
      settings.business_hours as BusinessHours,
    );

    // Decisao F: name/description vem dos campos canonicos (settings.store_name / settings.description),
    // com fallback pro tenant.name (nome) e descricao atual (description). Sem depender da duplicata em whatsapp_bot.store.
    const store: BotStoreConfig = {
      ...DEFAULT_STORE,
      ...(botSettings.store || {}),
      name: settings.store_name || tenant?.name || DEFAULT_STORE.name,
      description: settings.description || DEFAULT_STORE.description,
      business_hours: businessHours,
    };

    const rules: string[] = Array.isArray(botSettings.rules) && botSettings.rules.length > 0
      ? botSettings.rules
      : DEFAULT_RULES;

    return {
      persona,
      store,
      rules,
      model: botSettings.llm_model || 'gpt-4o-mini',
      temperature: typeof botSettings.llm_temperature === 'number'
        ? botSettings.llm_temperature
        : 0.3,
    };
  }
}
