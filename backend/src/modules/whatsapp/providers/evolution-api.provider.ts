import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IWhatsappProvider,
  SendMessageOptions,
  SendListOptions,
  ReceivedMessage,
} from './whatsapp-provider.interface';

/**
 * Evolution API WhatsApp Provider
 *
 * Suporta:
 * - Mensagens de texto
 * - Mensagens com botões interativos (Reply Buttons)
 * - Mensagens com imagens
 * - Validação de webhook
 */
@Injectable()
export class EvolutionApiProvider implements IWhatsappProvider {
  private readonly logger = new Logger(EvolutionApiProvider.name);
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor(private config: ConfigService) {
    this.apiUrl = this.config.get('EVOLUTION_API_URL', '');
    this.apiKey = this.config.get('EVOLUTION_API_KEY', '');
    this.instanceName = this.config.get('EVOLUTION_INSTANCE', 'default');
  }

  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  getProviderType(): 'twilio' | 'evolution' | 'wppconnect' {
    return 'evolution';
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendMessage(options: SendMessageOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Evolution API não configurada');
    }

    const url = `${this.apiUrl}/message/sendText/${this.instanceName}`;

    const payload = {
      number: this.formatPhone(options.to),
      text: options.body,
    };

    try {
      const response = await this.makeRequest(url, payload);
      const messageId = response?.key?.id || `evo_${Date.now()}`;

      this.logger.log(`[EVOLUTION] Mensagem enviada para ${options.to}`, {
        messageId,
      });

      return messageId;
    } catch (error) {
      this.logger.error('Erro ao enviar mensagem Evolution API', { error });
      throw error;
    }
  }

  /**
   * Envia mensagem com botões interativos (Reply Buttons)
   *
   * A Evolution API suporta botões via WhatsApp Interactive Messages
   */
  async sendInteractiveButtons(options: SendMessageOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Evolution API não configurada');
    }

    if (!options.buttons || options.buttons.length === 0) {
      return this.sendMessage(options);
    }

    const url = `${this.apiUrl}/message/sendInteractive/${this.instanceName}`;

    // Formatar botões para o formato da Evolution API
    const buttons = options.buttons.slice(0, 3).map((btn, idx) => ({
      buttonId: btn.id || `btn_${idx}`,
      buttonText: {
        displayText: btn.title,
      },
      type: 'reply',
    }));

    const payload = {
      number: this.formatPhone(options.to),
      message: options.body,
      buttons,
      headerType: 1, // 1 = imagem, 4 = texto
      title: options.body.substring(0, 60), // Título opcional
    };

    try {
      const response = await this.makeRequest(url, payload);
      const messageId = response?.key?.id || `evo_buttons_${Date.now()}`;

      this.logger.log(`[EVOLUTION] Botões enviados para ${options.to}`, {
        messageId,
        buttonsCount: buttons.length,
      });

      return messageId;
    } catch (error) {
      this.logger.error('Erro ao enviar botões Evolution API', { error });
      // Fallback: tenta enviar como mensagem normal
      return this.sendMessage(options);
    }
  }

  /**
   * Envia mensagem com lista interativa (Interactive List)
   */
  async sendInteractiveList(options: SendListOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Evolution API não configurada');
    }

    const url = `${this.apiUrl}/message/sendInteractive/${this.instanceName}`;

    const payload = {
      number: this.formatPhone(options.to),
      title: options.listSections.title || 'Selecione uma opção',
      message: options.body,
      footerText: options.listSections.footer || 'Toque em uma opção',
      listSections: options.listSections.sections.map((section) => ({
        title: section.title,
        rows: section.rows.map((row, idx) => ({
          title: row.title,
          description: row.description || '',
          rowId: row.id || `row_${idx}`,
        })),
      })),
      buttonText: options.listSections.buttonText || 'Ver opções',
    };

    try {
      const response = await this.makeRequest(url, payload);
      const messageId = response?.key?.id || `evo_list_${Date.now()}`;

      this.logger.log(`[EVOLUTION] Lista interativa enviada para ${options.to}`, {
        messageId,
      });

      return messageId;
    } catch (error) {
      this.logger.error('Erro ao enviar lista Evolution API', { error });
      return this.sendMessage(options);
    }
  }

  /**
   * Envia mensagem de mídia (imagem, etc)
   */
  async sendMedia(options: SendMessageOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Evolution API não configurada');
    }

    const url = `${this.apiUrl}/message/sendMedia/${this.instanceName}`;

    const payload = {
      number: this.formatPhone(options.to),
      mediaUrl: options.mediaUrl,
      caption: options.body,
      fileName: options.body?.substring(0, 50) || 'file',
    };

    try {
      const response = await this.makeRequest(url, payload);
      const messageId = response?.key?.id || `evo_media_${Date.now()}`;

      this.logger.log(`[EVOLUTION] Mídia enviada para ${options.to}`, {
        messageId,
        mediaUrl: options.mediaUrl,
      });

      return messageId;
    } catch (error) {
      this.logger.error('Erro ao enviar mídia Evolution API', { error });
      throw error;
    }
  }

  /**
   * Valida assinatura do webhook
   */
  async validateWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    // Evolution API valida via token na URL ou header
    const expectedToken = this.config.get('WHATSAPP_WEBHOOK_SECRET', '');

    if (!expectedToken) {
      this.logger.warn('[EVOLUTION] Webhook secret não configurado');
      return true;
    }

    return signature === expectedToken;
  }

  /**
   * Converte mensagem recebida para formato padrão
   */
  parseIncomingMessage(body: any): ReceivedMessage {
    // Formato Evolution API
    const key = body.key || {};
    const message = body.message || {};
    const remoteJid = key.remoteJid || '';

    // Extrair texto da mensagem
    let text = '';
    if (message.conversation) {
      text = message.conversation;
    } else if (message.extendedTextMessage) {
      text = message.extendedTextMessage.text || '';
    } else if (message.imageMessage) {
      text = message.imageMessage.caption || '';
    } else if (message.buttonsResponseMessage) {
      // Mensagem de clique em botão
      text = message.buttonsResponseMessage.selectedDisplayText || '';
    } else if (message.listResponseMessage) {
      // Mensagem de clique em lista
      text = message.listResponseMessage.title || '';
    }

    // Extrair ID do botão clicado (se houver)
    let buttonId: string | undefined;
    if (message.buttonsResponseMessage) {
      buttonId = message.buttonsResponseMessage.selectedButtonId || undefined;
    } else if (message.listResponseMessage) {
      buttonId = message.listResponseMessage.listResponse?.selectedRowId || undefined;
    }

    return {
      from: this.extractPhone(remoteJid),
      body: text,
      messageId: key.id || '',
      timestamp: new Date(key.timestamp ? key.timestamp * 1000 : Date.now()),
      mediaUrl: message.imageMessage?.url || message.videoMessage?.url || undefined,
      buttonId,
    };
  }

  // ============ Helpers ============

  private async makeRequest(url: string, payload: any): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private formatPhone(phone: string): string {
    // Remove tudo exceto números
    const numbers = phone.replace(/\D/g, '');

    // Adiciona @s.whatsapp.net se não tiver
    if (!phone.includes('@s.whatsapp.net')) {
      return numbers.includes('55')
        ? `${numbers}@s.whatsapp.net`
        : `55${numbers}@s.whatsapp.net`;
    }

    return phone;
  }

  private extractPhone(jid: string): string {
    // Extrai número do JID
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  }
}
