import { Injectable, Logger } from '@nestjs/common';
import { WhatsappConfigResolver } from './whatsapp-config.resolver';
import { CloudApiProvider } from '../providers/cloud-api.provider';
import { EvolutionApiProvider } from '../providers/evolution-api.provider';
import { MockWhatsappProvider } from '../providers/mock-whatsapp.provider';
import { isWhatsappConfigUsable } from './tenant-whatsapp-config';

export interface OutboundButton {
  id: string;
  title: string;
}

/**
 * Ponto de entrada UNICO e TENANT-AWARE para enviar WhatsApp.
 *
 * Resolve a config do tenant (provider + credenciais) e despacha pelo provider
 * correto. Os dois caminhos de envio do sistema (bot conversacional e
 * notificacoes de pedido) devem usar este servico, para que cada cliente do
 * SaaS envie pelo proprio numero.
 *
 * Fail-safe: se a config do tenant nao for utilizavel, degrada para log (mock)
 * em vez de quebrar o fluxo de negocio.
 */
@Injectable()
export class WhatsappSender {
  private readonly logger = new Logger(WhatsappSender.name);

  constructor(
    private readonly resolver: WhatsappConfigResolver,
    private readonly cloudApi: CloudApiProvider,
    private readonly evolution: EvolutionApiProvider,
    private readonly mock: MockWhatsappProvider,
  ) {}

  /** Envia texto simples pelo canal do tenant. */
  async sendText(tenantId: string, to: string, body: string): Promise<void> {
    await this.send(tenantId, to, body, []);
  }

  /** Envia mensagem com botoes (degrada para texto se o provider nao suportar). */
  async sendButtons(
    tenantId: string,
    to: string,
    body: string,
    buttons: OutboundButton[],
  ): Promise<void> {
    await this.send(tenantId, to, body, buttons);
  }

  private async send(
    tenantId: string,
    to: string,
    body: string,
    buttons: OutboundButton[],
  ): Promise<void> {
    if (!body?.trim()) return;

    const config = await this.resolver.resolve(tenantId);

    if (!isWhatsappConfigUsable(config)) {
      this.logger.warn('WhatsApp do tenant nao configurado; mensagem nao enviada (degradado).', {
        tenantId,
        provider: config.provider,
      });
      return;
    }

    try {
      switch (config.provider) {
        case 'cloud_api': {
          const creds = config.cloudApi!;
          if (buttons.length > 0) {
            await this.cloudApi.sendButtons(creds, to, body, buttons);
          } else {
            await this.cloudApi.sendText(creds, to, body);
          }
          return;
        }

        case 'evolution': {
          // LEGADO/compatibilidade: o EvolutionApiProvider le credenciais globais
          // no boot (nao per-tenant). Mantido so para tenants ainda em Evolution;
          // novos clientes usam cloud_api (per-tenant de verdade).
          if (buttons.length > 0) {
            await this.evolution.sendInteractiveButtons({ to, body, buttons });
          } else {
            await this.evolution.sendMessage({ to, body });
          }
          return;
        }

        case 'mock':
        default: {
          if (buttons.length > 0) {
            await this.mock.sendInteractiveButtons({ to, body, buttons });
          } else {
            await this.mock.sendMessage({ to, body });
          }
          return;
        }
      }
    } catch (error) {
      // Degradacao: tenta texto puro se o interativo falhou; senao so loga.
      this.logger.error('Falha ao enviar WhatsApp; tentando degradar para texto.', {
        tenantId,
        provider: config.provider,
        error: error instanceof Error ? error.message : String(error),
      });
      if (buttons.length > 0) {
        try {
          await this.send(tenantId, to, body, []);
        } catch {
          /* ja logado */
        }
      }
    }
  }
}
