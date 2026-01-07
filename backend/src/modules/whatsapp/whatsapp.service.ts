import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from './services/openai.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { CanalVenda, PedidoStatus } from '../../database/entities/Pedido.entity';

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
    private ordersService: OrdersService,
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

    // Comando: Fazer Pedido
    if (lowerMessage.includes('quero') || lowerMessage.includes('preciso') || 
        lowerMessage.includes('comprar') || lowerMessage.includes('pedir') ||
        lowerMessage.includes('vou querer')) {
      return await this.processOrder(message, tenantId);
    }

    // Resposta padrão
    return this.getRespostaPadrao();
  }

  private async processOrder(message: string, tenantId: string): Promise<string> {
    try {
      // Extrair quantidade e produto da mensagem
      const orderInfo = this.extractOrderInfo(message);
      
      if (!orderInfo.quantity || !orderInfo.productName) {
        return '❌ Não consegui entender seu pedido.\n\n' +
               '💬 Por favor, digite no formato:\n' +
               '*"Quero X [nome do produto]"*\n\n' +
               'Exemplo: "Quero 10 brigadeiros"';
      }

      // Buscar produto
      const produtos = await this.productsService.findAll(tenantId);
      const produto = this.findProductByName(produtos, orderInfo.productName);

      if (!produto) {
        return `❌ Não encontrei o produto "${orderInfo.productName}".\n\n` +
               '💬 Digite *"cardápio"* para ver nossos produtos disponíveis.';
      }

      // Validar estoque
      if (produto.available_stock < orderInfo.quantity) {
        return `❌ Estoque insuficiente!\n\n` +
               `*${produto.name}*\n` +
               `Solicitado: ${orderInfo.quantity} unidades\n` +
               `Disponível: ${produto.available_stock} unidades\n\n` +
               `💬 Quer fazer pedido com a quantidade disponível?`;
      }

      // Criar pedido
      try {
        const pedido = await this.ordersService.create({
          channel: CanalVenda.WHATSAPP,
          customer_phone: 'whatsapp', // Será atualizado quando tiver número real
          items: [{
            produto_id: produto.id,
            quantity: orderInfo.quantity,
            unit_price: Number(produto.price),
          }],
          discount_amount: 0,
          shipping_amount: 0,
        }, tenantId);

        const total = Number(produto.price) * orderInfo.quantity;
        
        return `✅ *PEDIDO CRIADO COM SUCESSO!*\n\n` +
               `📦 *${produto.name}*\n` +
               `Quantidade: ${orderInfo.quantity} unidades\n` +
               `Preço unitário: R$ ${Number(produto.price).toFixed(2).replace('.', ',')}\n` +
               `Total: R$ ${total.toFixed(2).replace('.', ',')}\n\n` +
               `🆔 Código do pedido: *${pedido.order_no}*\n` +
               `📊 Status: ${this.formatStatus(pedido.status)}\n\n` +
               `💬 Aguarde a confirmação do pagamento!`;
      } catch (error) {
        this.logger.error(`Error creating order: ${error}`);
        
        if (error instanceof BadRequestException) {
          return `❌ ${error.message}\n\n` +
                 `💬 Verifique o estoque e tente novamente.`;
        }
        
        return '❌ Ocorreu um erro ao criar seu pedido.\n\n' +
               '💬 Tente novamente em alguns instantes.';
      }
    } catch (error) {
      this.logger.error(`Error processing order: ${error}`);
      return '❌ Ocorreu um erro ao processar seu pedido.\n\n' +
             '💬 Tente novamente ou digite *"ajuda"* para ver os comandos.';
    }
  }

  private extractOrderInfo(message: string): { quantity: number | null; productName: string | null } {
    const lowerMessage = message.toLowerCase();
    
    // Extrair número (quantidade) - pode estar no início ou meio
    const quantityMatch = lowerMessage.match(/(\d+)/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

    // Extrair nome do produto
    // Estratégia: remover palavras de ação e números, manter o resto
    let productName = lowerMessage
      // Remover palavras de ação
      .replace(/\b(quero|preciso|comprar|pedir|vou querer|gostaria de|desejo|vou comprar|preciso de)\b/gi, '')
      // Remover números
      .replace(/\d+/g, '')
      // Remover unidades
      .replace(/\b(unidades?|unidade|un|peças?|peça|pç|kg|kilo|gramas?|g)\b/gi, '')
      // Remover artigos e preposições (mas manter se for parte do nome, ex: "Bolo de Chocolate")
      .replace(/\b(de|do|da|dos|das)\b/gi, ' ')
      // Remover artigos no início/fim
      .replace(/^\s*(o|a|os|as|um|uma)\s+/gi, '')
      .replace(/\s+(o|a|os|as|um|uma)\s*$/gi, '')
      .trim()
      // Limpar espaços múltiplos
      .replace(/\s+/g, ' ');

    // Se não sobrou nada útil, tentar buscar produto após número
    if (!productName || productName.length < 3) {
      if (quantityMatch) {
        // Pegar tudo após o número
        const afterNumber = lowerMessage.substring(quantityMatch.index! + quantityMatch[0].length);
        productName = afterNumber
          .replace(/\b(quero|preciso|comprar|pedir|vou querer|gostaria de|desejo|de|do|da|dos|das|o|a|os|as|unidades?|unidade|un|peças?|peça|pç)\b/gi, ' ')
          .trim()
          .replace(/\s+/g, ' ');
      }
    }

    return {
      quantity,
      productName: productName && productName.length >= 3 ? productName : null,
    };
  }

  private findProductByName(produtos: any[], productName: string): any | null {
    if (!productName) return null;

    const palavras = productName.toLowerCase().split(/\s+/).filter(p => p.length > 2);
    
    if (palavras.length === 0) return null;

    // Estratégia 1: Buscar por nome exato (todas as palavras)
    let produto = produtos.find(p => {
      const nomeLower = p.name.toLowerCase();
      return palavras.every(palavra => nomeLower.includes(palavra));
    });

    // Estratégia 2: Buscar por qualquer palavra (se não encontrou)
    if (!produto) {
      produto = produtos.find(p => 
        palavras.some(palavra => p.name.toLowerCase().includes(palavra))
      );
    }

    return produto || null;
  }

  private formatStatus(status: PedidoStatus): string {
    const statusMap: Record<PedidoStatus, string> = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: '⏳ Aguardando Pagamento',
      [PedidoStatus.CONFIRMADO]: '✅ Confirmado',
      [PedidoStatus.EM_PRODUCAO]: '👨‍🍳 Em Produção',
      [PedidoStatus.PRONTO]: '🎉 Pronto',
      [PedidoStatus.EM_TRANSITO]: '🚚 Em Trânsito',
      [PedidoStatus.ENTREGUE]: '✅ Entregue',
      [PedidoStatus.CANCELADO]: '❌ Cancelado',
    };
    return statusMap[status] || status;
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
        .replace(/preco|preço|valor|quanto|custa|de|o|a|os|as|do|da|dos|das/gi, '')
        .trim()
        .split(/\s+/)
        .filter(p => p.length > 2);

      let produtoEncontrado = null;
      const produtos = await this.productsService.findAll(tenantId);

      // Se tem palavras-chave, buscar produto específico
      if (palavras.length > 0) {
        // Estratégia 1: Buscar por todas as palavras (produto composto)
        const queryCompleta = palavras.join(' ');
        produtoEncontrado = produtos.find(p => {
          const nomeLower = p.name.toLowerCase();
          return nomeLower.includes(queryCompleta);
        });

        // Estratégia 2: Buscar por todas as palavras individualmente (todas devem estar no nome)
        if (!produtoEncontrado) {
          produtoEncontrado = produtos.find(p => {
            const nomeLower = p.name.toLowerCase();
            return palavras.every(palavra => nomeLower.includes(palavra));
          });
        }

        // Estratégia 3: Usar busca do service
        if (!produtoEncontrado) {
          const produtosBuscados = await this.productsService.search(tenantId, queryCompleta);
          
          if (produtosBuscados.length > 0) {
            produtoEncontrado = produtos.find(p => p.id === produtosBuscados[0].id);
          }
        }

        // Estratégia 4: Buscar por qualquer palavra (fallback)
        if (!produtoEncontrado && palavras.length === 1) {
          produtoEncontrado = produtos.find(p => 
            p.name.toLowerCase().includes(palavras[0])
          );
        }
      }

      if (produtoEncontrado) {
        return `💰 *${produtoEncontrado.name}*\n\n` +
               `Preço: R$ ${Number(produtoEncontrado.price).toFixed(2).replace('.', ',')}\n` +
               `Estoque disponível: ${produtoEncontrado.available_stock} unidades\n\n` +
               `💬 Quer fazer um pedido? Digite: "Quero X ${produtoEncontrado.name}"`;
      }

      // Se não encontrou produto específico, mostrar alguns produtos
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
        .replace(/estoque|tem|disponivel|disponível|de|o|a|os|as|do|da|dos|das/gi, '')
        .trim()
        .split(/\s+/)
        .filter(p => p.length > 2);

      let produtoEncontrado = null;
      const produtos = await this.productsService.findAll(tenantId);

      // Se tem palavras-chave, buscar produto específico
      if (palavras.length > 0) {
        // Estratégia 1: Buscar por todas as palavras (produto composto)
        const queryCompleta = palavras.join(' ');
        produtoEncontrado = produtos.find(p => {
          const nomeLower = p.name.toLowerCase();
          return nomeLower.includes(queryCompleta);
        });

        // Estratégia 2: Buscar por todas as palavras individualmente (todas devem estar no nome)
        if (!produtoEncontrado) {
          produtoEncontrado = produtos.find(p => {
            const nomeLower = p.name.toLowerCase();
            return palavras.every(palavra => nomeLower.includes(palavra));
          });
        }

        // Estratégia 3: Usar busca do service
        if (!produtoEncontrado) {
          const produtosBuscados = await this.productsService.search(tenantId, queryCompleta);
          
          if (produtosBuscados.length > 0) {
            produtoEncontrado = produtos.find(p => p.id === produtosBuscados[0].id);
          }
        }

        // Estratégia 4: Buscar por qualquer palavra (fallback)
        if (!produtoEncontrado && palavras.length === 1) {
          produtoEncontrado = produtos.find(p => 
            p.name.toLowerCase().includes(palavras[0])
          );
        }
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