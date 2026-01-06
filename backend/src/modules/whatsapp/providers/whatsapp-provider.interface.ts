export interface SendMessageOptions {
  to: string;
  body: string;
  mediaUrl?: string;
  buttons?: Array<{ id: string; title: string }>;
}

export interface ReceivedMessage {
  from: string;
  body: string;
  messageId: string;
  timestamp: Date;
  mediaUrl?: string;
  buttonId?: string;
}

export interface IWhatsappProvider {
  /**
   * Envia mensagem de texto
   */
  sendMessage(options: SendMessageOptions): Promise<string>;

  /**
   * Envia mensagem com mídia (imagem, QR Code, etc)
   */
  sendMedia(options: SendMessageOptions): Promise<string>;

  /**
   * Valida assinatura do webhook (segurança)
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean>;

  /**
   * Verifica se o provedor está configurado e funcionando
   */
  isConfigured(): boolean;

  /**
   * Retorna tipo do provedor
   */
  getProviderType(): 'twilio' | 'evolution' | 'wppconnect';

  /**
   * Converte mensagem recebida para formato padrão
   */
  parseIncomingMessage(body: any): ReceivedMessage;
}

