import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from './services/openai.service';

export interface WhatsappMessage {
  from: string;
  body: string;
  timestamp: string;
}

export interface ProductInfo {
  name: string;
  price: number;
  stock: number;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private config: ConfigService,
    private openAIService: OpenAIService,
  ) {}

  async processIncomingMessage(message: WhatsappMessage): Promise<void> {
    this.logger.log(`Processing message from ${message.from}: ${message.body}`);

    try {
      // Por enquanto, retorna resposta simples
      // TODO: Integrar com OpenAI para processar naturalmente
      const response = this.generateSimpleResponse(message.body);
      
      this.logger.log(`Response: ${response}`);
      // await this.sendMessage(message.from, response);
    } catch (error) {
      this.logger.error(`Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateSimpleResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('ola') || lowerMessage.includes('oi')) {
      return 'Ola! Bem vindo a nossa loja! Como posso ajudar?';
    }

    if (lowerMessage.includes('cardapio') || lowerMessage.includes('menu')) {
      return 'Temos brigadeiros, trufas e bolos! Quer ver nosso cardapio completo?';
    }

    if (lowerMessage.includes('preco') || lowerMessage.includes('valor')) {
      return 'Brigadeiros: R$ 2,00 cada. Trufas: R$ 3,50 cada. Quer algum em especifico?';
    }

    return 'Desculpe, ainda estou aprendendo! Posso ajudar com informacoes sobre produtos e pedidos.';
  }

  async sendMessage(to: string, message: string): Promise<void> {
    this.logger.log(`Would send message to ${to}: ${message}`);
    // TODO: Implementar envio via Twilio quando configurado
  }

  async sendProductList(to: string, products: ProductInfo[]): Promise<void> {
    let messageText = 'Nossos produtos:\n\n';
    
    products.forEach((product, index) => {
      messageText += `${index + 1}. ${product.name} - R$ ${product.price.toFixed(2)}\n`;
      messageText += `   Estoque: ${product.stock}\n\n`;
    });

    messageText += 'Digite o numero do produto que voce quer!';

    await this.sendMessage(to, messageText);
  }
}