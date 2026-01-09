import { Injectable, Logger } from '@nestjs/common';
import {
  IWhatsappProvider,
  SendMessageOptions,
  ReceivedMessage,
} from './whatsapp-provider.interface';

/**
 * Mock WhatsApp Provider - Para desenvolvimento sem custo
 * 
 * Simula envio/recebimento de mensagens WhatsApp
 * Útil para desenvolvimento e testes locais
 */
@Injectable()
export class MockWhatsappProvider implements IWhatsappProvider {
  private readonly logger = new Logger(MockWhatsappProvider.name);
  
  // Armazena mensagens enviadas (para testes)
  private sentMessages: Array<{
    to: string;
    message: string;
    timestamp: Date;
  }> = [];

  async sendMessage(options: SendMessageOptions): Promise<string> {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(
      `[MOCK] WhatsApp → ${options.to}: ${options.body.substring(0, 50)}...`
    );

    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 100));

    // Armazena mensagem para teste
    this.sentMessages.push({
      to: options.to,
      message: options.body,
      timestamp: new Date(),
    });

    this.logger.debug(`[MOCK] Message ID: ${messageId}`);

    return messageId;
  }

  async sendMedia(options: SendMessageOptions): Promise<string> {
    const messageId = `mock_media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(
      `[MOCK] WhatsApp Media → ${options.to}: ${options.mediaUrl}`
    );

    await new Promise(resolve => setTimeout(resolve, 200));

    this.sentMessages.push({
      to: options.to,
      message: `[Media: ${options.mediaUrl}] ${options.body || ''}`,
      timestamp: new Date(),
    });

    return messageId;
  }

  async validateWebhookSignature(
    _payload: string,
    _signature: string,
  ): Promise<boolean> {
    // Mock sempre retorna true (desenvolvimento)
    // Em produção, validar assinatura real
    this.logger.warn(
      '[MOCK] Webhook signature validation skipped (development mode)'
    );
    return true;
  }

  isConfigured(): boolean {
    // Mock sempre está configurado
    return true;
  }

  getProviderType(): 'twilio' | 'evolution' | 'wppconnect' {
    return 'evolution'; // Compatibilidade
  }

  parseIncomingMessage(body: any): ReceivedMessage {
    // Converte formato mock para ReceivedMessage
    return {
      from: body.from || body.From || body.number || '5511999999999',
      body: body.body || body.Body || body.text || '',
      messageId: body.messageId || body.id || `mock_${Date.now()}`,
      timestamp: body.timestamp 
        ? new Date(body.timestamp) 
        : new Date(),
      mediaUrl: body.mediaUrl || body.media?.url,
      buttonId: body.buttonId || body.button?.id,
    };
  }

  /**
   * Simula recebimento de mensagem (para testes)
   */
  async simulateIncomingMessage(
    from: string,
    body: string,
    messageId?: string,
  ): Promise<ReceivedMessage> {
    const message: ReceivedMessage = {
      from,
      body,
      messageId: messageId || `mock_incoming_${Date.now()}`,
      timestamp: new Date(),
    };

    this.logger.log(`[MOCK] Simulated incoming message from ${from}: ${body}`);

    return message;
  }

  /**
   * Retorna histórico de mensagens enviadas (para testes)
   */
  getSentMessages(): Array<{ to: string; message: string; timestamp: Date }> {
    return [...this.sentMessages];
  }

  /**
   * Limpa histórico de mensagens (para testes)
   */
  clearHistory(): void {
    this.sentMessages = [];
    this.logger.debug('[MOCK] Message history cleared');
  }
}
