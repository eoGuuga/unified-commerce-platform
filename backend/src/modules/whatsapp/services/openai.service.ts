import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MessageIntent {
  intent: 'consultar' | 'fazer_pedido' | 'cancelar' | 'outro';
  product?: string;
  quantity?: number;
  confidence: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private config: ConfigService) {}

  async processMessage(message: string): Promise<MessageIntent> {
    const apiKey = this.config.get('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured, using fallback');
      return this.fallbackProcessing(message);
    }

    // TODO: Implementar chamada real à API OpenAI
    this.logger.log('OpenAI processing not yet implemented');
    return this.fallbackProcessing(message);
  }

  private fallbackProcessing(message: string): MessageIntent {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('quero') || lowerMessage.includes('preciso') || lowerMessage.includes('compra')) {
      return {
        intent: 'fazer_pedido',
        confidence: 0.6,
      };
    }

    if (lowerMessage.includes('cancelar') || lowerMessage.includes('desistir')) {
      return {
        intent: 'cancelar',
        confidence: 0.7,
      };
    }

    return {
      intent: 'consultar',
      confidence: 0.5,
    };
  }
}