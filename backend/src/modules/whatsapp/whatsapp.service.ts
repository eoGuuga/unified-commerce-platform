import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from './services/openai.service';
import { ProductsService } from '../products/products.service';

export interface WhatsappMessage {
  from: string;
  body: string;
  timestamp: string;
  tenantId?: string;
}

export interface ProductInfo {
  name: string;
  price: number;
  stock: number;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';
  private readonly HORARIO_FUNCIONAMENTO = 'Segunda a Sábado: 8h às 18h\nDomingo: 9h às 13h';

  constructor(
    private config: ConfigService,
    private openAIService: OpenAIService,
    private productsService: ProductsService,
  ) {}

  async processIncomingMessage(message: WhatsappMessage): Promise<string> {
    this.logger.log(`Processing message from ${message.from}: ${message.body}`);

    try {
      const tenantId = message.tenantId || this.DEFAULT_TENANT_ID;
      const response = await this.generateResponse(message.body, tenantId);
      
      this.logger.log(`Response: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(`Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.';
    }
  }

  private async generateResponse(message: string, tenantId: string): Promise<string> {
    const lowerMessage = message.toLowerCase().trim();

    // Comando: Cardápio / Menu
    if (lowerMessage.includes('cardapio') || lowerMessage.includes('menu') || lowerMessage.includes('produtos')) {
      return await this.getCardapio(tenantId);
    }

    // Comando: Preço de [produto]
    if (lowerMessage.includes('preco') || lowerMessage.includes('valor') || lowerMessage.includes('quanto custa')) {
      return await this.getPreco(message, tenantId);
    }

    // Comando: Estoque de [produto]
    if (lowerMessage.includes('estoque') || lowerMessage.includes('tem') || lowerMessage.includes('disponivel')) {
      return await this.getEstoque(message, tenantId);
    }

    // Comando: Horário
    if (lowerMessage.includes('horario') || lowerMessage.includes('funciona') || lowerMessage.includes('aberto')) {
      return this.getHorario();
    }

    // Comando: Ajuda
    if (lowerMessage.includes('ajuda') || lowerMessage.includes('help') || lowerMessage.includes('comandos')) {
      return this.getAjuda();
    }

    // Saudação
    if (lowerMessage.includes('ola') || lowerMessage.includes('oi') || lowerMessage.includes('bom dia') || 
        lowerMessage.includes('boa tarde') || lowerMessage.includes('boa noite')) {
      return this.getSaudacao();
    }

    // Resposta padrão
    return this.getRespostaPadrao();
  }

  private async getCardapio(tenantId: string): Promise<string> {
    try {
      const produtos = await this.productsService.findAll(tenantId);
      
      if (produtos.length === 0) {
        return '📋 *Cardápio*\n\nNão temos produtos cadastrados no momento.';
      }

      // Agrupar por categoria
      const porCategoria: Record<string, any[]> = {};
      produtos.forEach(produto => {
        const categoria = produto.categoria?.name || 'Outros';
        if (!porCategoria[categoria]) {
          porCategoria[categoria] = [];
        }
        porCategoria[categoria].push(produto);
      });

      let mensagem = '📋 *NOSSO CARDÁPIO*\n\n';
      
      Object.keys(porCategoria).forEach(categoria => {
        mensagem += `*${categoria.toUpperCase()}*\n`;
        porCategoria[categoria].forEach(produto => {
          const emoji = produto.available_stock > 0 ? '✅' : '❌';
          mensagem += `${emoji} ${produto.name} - R$ ${Number(produto.price).toFixed(2).replace('.', ',')}\n`;
        });
        mensagem += '\n';
      });

      mensagem += '💬 Digite o *nome do produto* para mais informações ou para fazer um pedido!';
      
      return mensagem;
    } catch (error) {
      this.logger.error(`Error getting cardapio: ${error}`);
      return 'Desculpe, não consegui buscar o cardápio no momento. Tente novamente.';
    }
  }

  private async getPreco(message: string, tenantId: string): Promise<string> {
    try {
      // Extrair palavras-chave da mensagem (remover "preço", "valor", "quanto custa")
      const palavras = message.toLowerCase()
        .replace(/preco|preço|valor|quanto|custa|de|o|a|os|as/gi, '')
        .trim()
        .split(/\s+/)
        .filter(p => p.length > 2);

      let produtoEncontrado = null;

      // Se tem palavras-chave, buscar produto específico
      if (palavras.length > 0) {
        const query = palavras.join(' ');
        const produtosBuscados = await this.productsService.search(tenantId, query);
        
        if (produtosBuscados.length > 0) {
          // Buscar estoque para o primeiro resultado
          const produtos = await this.productsService.findAll(tenantId);
          produtoEncontrado = produtos.find(p => p.id === produtosBuscados[0].id);
        }
      }

      // Se não encontrou, buscar em todos os produtos
      if (!produtoEncontrado) {
        const produtos = await this.productsService.findAll(tenantId);
        produtoEncontrado = produtos.find(p => 
          palavras.some(palavra => p.name.toLowerCase().includes(palavra))
        );
      }

      if (produtoEncontrado) {
        return `💰 *${produtoEncontrado.name}*\n\n` +
               `Preço: R$ ${Number(produtoEncontrado.price).toFixed(2).replace('.', ',')}\n` +
               `Estoque disponível: ${produtoEncontrado.available_stock} unidades\n\n` +
               `💬 Quer fazer um pedido? Digite: "Quero X ${produtoEncontrado.name}"`;
      }

      // Se não encontrou produto específico, mostrar alguns produtos
      const produtos = await this.productsService.findAll(tenantId);
      if (produtos.length > 0) {
        let mensagem = '💰 *PREÇOS*\n\n';
        produtos.slice(0, 5).forEach(produto => {
          mensagem += `• ${produto.name}: R$ ${Number(produto.price).toFixed(2).replace('.', ',')}\n`;
        });
        mensagem += '\n💬 Digite o nome do produto para mais detalhes!';
        return mensagem;
      }

      return 'Não encontrei produtos. Digite "cardápio" para ver nossa lista completa.';
    } catch (error) {
      this.logger.error(`Error getting preco: ${error}`);
      return 'Desculpe, não consegui buscar o preço no momento.';
    }
  }

  private async getEstoque(message: string, tenantId: string): Promise<string> {
    try {
      // Extrair palavras-chave da mensagem (remover "estoque", "tem", "disponivel")
      const palavras = message.toLowerCase()
        .replace(/estoque|tem|disponivel|disponível|de|o|a|os|as/gi, '')
        .trim()
        .split(/\s+/)
        .filter(p => p.length > 2);

      let produtoEncontrado = null;

      // Se tem palavras-chave, buscar produto específico
      if (palavras.length > 0) {
        const query = palavras.join(' ');
        const produtosBuscados = await this.productsService.search(tenantId, query);
        
        if (produtosBuscados.length > 0) {
          // Buscar estoque para o primeiro resultado
          const produtos = await this.productsService.findAll(tenantId);
          produtoEncontrado = produtos.find(p => p.id === produtosBuscados[0].id);
        }
      }

      // Se não encontrou, buscar em todos os produtos
      if (!produtoEncontrado) {
        const produtos = await this.productsService.findAll(tenantId);
        produtoEncontrado = produtos.find(p => 
          palavras.length > 0 && palavras.some(palavra => p.name.toLowerCase().includes(palavra))
        );
      }

      if (produtoEncontrado) {
        const emoji = produtoEncontrado.available_stock > 0 ? '✅' : '❌';
        return `${emoji} *${produtoEncontrado.name}*\n\n` +
               `Estoque disponível: *${produtoEncontrado.available_stock}* unidades\n` +
               `Estoque total: ${produtoEncontrado.stock} unidades\n` +
               (produtoEncontrado.available_stock === 0 
                 ? '\n⚠️ Este produto está sem estoque no momento.' 
                 : '\n💬 Quer fazer um pedido? Digite: "Quero X ' + produtoEncontrado.name + '"');
      }

      // Se não encontrou produto específico, mostrar produtos com estoque baixo
      const produtos = await this.productsService.findAll(tenantId);
      const produtosBaixoEstoque = produtos.filter(p => p.available_stock > 0 && p.available_stock <= (p.min_stock || 5));
      
      if (produtosBaixoEstoque.length > 0) {
        let mensagem = '⚠️ *PRODUTOS COM ESTOQUE BAIXO*\n\n';
        produtosBaixoEstoque.forEach(produto => {
          mensagem += `• ${produto.name}: ${produto.available_stock} unidades\n`;
        });
        return mensagem;
      }

      return 'Digite o nome do produto para verificar o estoque. Exemplo: "Estoque de brigadeiro"';
    } catch (error) {
      this.logger.error(`Error getting estoque: ${error}`);
      return 'Desculpe, não consegui verificar o estoque no momento.';
    }
  }

  private getHorario(): string {
    return '🕐 *HORÁRIO DE FUNCIONAMENTO*\n\n' + this.HORARIO_FUNCIONAMENTO + '\n\n' +
           '💬 Estamos prontos para atender você!';
  }

  private getAjuda(): string {
    return '💬 *COMO POSSO AJUDAR?*\n\n' +
           'Digite um dos comandos abaixo:\n\n' +
           '📋 *cardápio* - Ver todos os produtos\n' +
           '💰 *preço de [produto]* - Ver preço de um produto\n' +
           '📦 *estoque de [produto]* - Ver estoque disponível\n' +
           '🕐 *horário* - Ver horário de funcionamento\n' +
           '🛒 *quero X [produto]* - Fazer um pedido\n\n' +
           '💬 Exemplo: "Quero 10 brigadeiros"';
  }

  private getSaudacao(): string {
    return '👋 Olá! Bem-vindo(a) à nossa loja!\n\n' +
           'Como posso ajudar você hoje?\n\n' +
           '💬 Digite *ajuda* para ver os comandos disponíveis.';
  }

  private getRespostaPadrao(): string {
    return 'Desculpe, não entendi sua mensagem. 😅\n\n' +
           '💬 Digite *ajuda* para ver como posso ajudar você!';
  }

  async sendMessage(to: string, message: string): Promise<void> {
    this.logger.log(`Would send message to ${to}: ${message}`);
    // TODO: Implementar envio via Twilio/Evolution API quando configurado
    // Por enquanto, apenas loga a mensagem
  }
}