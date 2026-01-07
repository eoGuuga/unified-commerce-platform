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

    // IMPORTANTE: Verificar pedidos PRIMEIRO (antes de outras respostas)
    // Comando: Fazer Pedido
    if (lowerMessage.includes('quero') || lowerMessage.includes('preciso') || 
        lowerMessage.includes('comprar') || lowerMessage.includes('pedir') ||
        lowerMessage.includes('vou querer') || lowerMessage.includes('gostaria de')) {
      return await this.processOrder(message, tenantId);
    }

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

  private async processOrder(message: string, tenantId: string): Promise<string> {
    try {
      // Extrair quantidade e produto da mensagem
      const orderInfo = this.extractOrderInfo(message);
      
      this.logger.debug(`Order extraction: quantity=${orderInfo.quantity}, productName="${orderInfo.productName}"`);
      
      // Se não tem quantidade, perguntar ao usuário
      if (!orderInfo.quantity && orderInfo.productName) {
        return `❓ Quantos *${orderInfo.productName}* você gostaria?\n\n` +
               '💬 Digite a quantidade, por exemplo:\n' +
               '*"5 brigadeiros"* ou *"uma dúzia"*';
      }
      
      // Se não tem produto, mas tem quantidade, perguntar qual produto
      if (orderInfo.quantity && !orderInfo.productName) {
        return `❓ Qual produto você gostaria de ${orderInfo.quantity} unidades?\n\n` +
               '💬 Digite *"cardápio"* para ver nossos produtos disponíveis.';
      }
      
      // Se não tem nem quantidade nem produto
      if (!orderInfo.quantity || !orderInfo.productName) {
        return '❌ Não consegui entender seu pedido.\n\n' +
               '💬 Por favor, digite no formato:\n' +
               '*"Quero 10 brigadeiros"*\n' +
               '*"Me manda 5 bolos de chocolate"*\n' +
               '*"Preciso de uma dúzia de brigadeiros"*\n\n' +
               '💡 Ou digite *"ajuda"* para ver mais exemplos.';
      }

      // A partir daqui, temos certeza que quantity e productName não são null
      const quantity = orderInfo.quantity;
      const productName = orderInfo.productName;

      // Buscar produto
      const produtos = await this.productsService.findAll(tenantId);
      const resultadoBusca = this.findProductByName(produtos, productName);
      
      this.logger.debug(`Product search: found=${!!resultadoBusca.produto}, searched="${productName}", suggestions=${resultadoBusca.sugestoes?.length || 0}`);

      // Se não encontrou produto exato, mas tem sugestões
      if (!resultadoBusca.produto && resultadoBusca.sugestoes && resultadoBusca.sugestoes.length > 0) {
        if (resultadoBusca.sugestoes.length === 1) {
          // Só uma sugestão - usar ela
          const produto = resultadoBusca.sugestoes[0];
          this.logger.debug(`Using single suggestion: ${produto.name}`);
          // Continuar com o produto sugerido
          return await this.createOrderWithProduct(produto, quantity, tenantId);
        } else {
          // Múltiplas sugestões - perguntar qual
          let mensagem = `❓ Não encontrei exatamente "${productName}", mas você quis dizer:\n\n`;
          resultadoBusca.sugestoes.forEach((p, index) => {
            mensagem += `${index + 1}. *${p.name}*\n`;
          });
          mensagem += '\n💬 Digite o número ou o nome completo do produto que você quer.';
          return mensagem;
        }
      }

      // Se não encontrou e não tem sugestões
      if (!resultadoBusca.produto) {
        // Tentar buscar produtos similares para sugerir
        const produtosSimilares = this.findSimilarProducts(produtos, productName);
        
        if (produtosSimilares.length > 0) {
          let mensagem = `❓ Não encontrei "${productName}". Você quis dizer:\n\n`;
          produtosSimilares.slice(0, 5).forEach((p, index) => {
            mensagem += `${index + 1}. *${p.name}*\n`;
          });
          mensagem += '\n💬 Digite o número ou o nome completo do produto.';
          mensagem += '\n💡 Ou digite *"cardápio"* para ver todos os produtos.';
          return mensagem;
        }
        
        return `❌ Não encontrei o produto "${productName}".\n\n` +
               '💬 Digite *"cardápio"* para ver nossos produtos disponíveis.';
      }

      const produto = resultadoBusca.produto;

      return await this.createOrderWithProduct(produto, quantity, tenantId);
    } catch (error) {
      this.logger.error(`Error processing order: ${error}`);
      return '❌ Ocorreu um erro ao processar seu pedido.\n\n' +
             '💬 Tente novamente ou digite *"ajuda"* para ver os comandos.';
    }
  }

  private async createOrderWithProduct(produto: any, quantity: number, tenantId: string): Promise<string> {
    // Validar estoque
    if (produto.available_stock < quantity) {
      return `❌ Estoque insuficiente!\n\n` +
             `*${produto.name}*\n` +
             `Solicitado: ${quantity} unidades\n` +
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
          quantity: quantity,
          unit_price: Number(produto.price),
        }],
        discount_amount: 0,
        shipping_amount: 0,
      }, tenantId);

      const total = Number(produto.price) * quantity;
      
      return `✅ *PEDIDO CRIADO COM SUCESSO!*\n\n` +
             `📦 *${produto.name}*\n` +
             `Quantidade: ${quantity} unidades\n` +
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
  }

  private extractOrderInfo(message: string): { quantity: number | null; productName: string | null } {
    const lowerMessage = message.toLowerCase().trim();
    
    // ============================================
    // ETAPA 1: EXTRAIR QUANTIDADE (múltiplas formas)
    // ============================================
    let quantity: number | null = null;
    
    // 1.1. Números escritos por extenso (um, dois, três, etc.)
    const numerosExtenso: Record<string, number> = {
      'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3,
      'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8,
      'nove': 9, 'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13,
      'quatorze': 14, 'quinze': 15, 'dezesseis': 16, 'dezessete': 17,
      'dezoito': 18, 'dezenove': 19, 'vinte': 20, 'trinta': 30,
      'quarenta': 40, 'cinquenta': 50, 'cem': 100
    };
    
    for (const [palavra, valor] of Object.entries(numerosExtenso)) {
      const regex = new RegExp(`\\b${palavra}\\b`, 'i');
      if (regex.test(lowerMessage)) {
        quantity = valor;
        break;
      }
    }
    
    // 1.2. Números digitais (5, 10, 100, etc.)
    if (!quantity) {
      const quantityMatch = lowerMessage.match(/(\d+)/);
      if (quantityMatch) {
        quantity = parseInt(quantityMatch[1]);
      }
    }
    
    // 1.3. Expressões de quantidade (dúzia, meia dúzia, quilo, etc.)
    if (!quantity) {
      if (lowerMessage.includes('duzia') || lowerMessage.includes('dúzia')) {
        quantity = 12;
      } else if (lowerMessage.includes('meia duzia') || lowerMessage.includes('meia dúzia')) {
        quantity = 6;
      } else if (lowerMessage.includes('quilo') || lowerMessage.includes('kg') || lowerMessage.includes('kilo')) {
        // Assumir 1 quilo (pode ser ajustado depois)
        quantity = 1;
      } else if (lowerMessage.match(/\d+\s*(g|gramas?)/)) {
        // Quantidade em gramas (ex: "500g de brigadeiros")
        const gramasMatch = lowerMessage.match(/(\d+)\s*(g|gramas?)/);
        if (gramasMatch) {
          // Converter gramas para quantidade aproximada (ex: 500g ≈ 20 brigadeiros)
          // Por enquanto, usar o número direto
          quantity = parseInt(gramasMatch[1]);
        }
      }
    }
    
    // 1.4. Quantidades indefinidas (uns, algumas, vários, etc.)
    // Se não encontrou quantidade específica, mas tem palavras de quantidade indefinida
    if (!quantity) {
      const indefinidas = ['uns', 'umas', 'alguns', 'algumas', 'vários', 'várias', 'um monte', 'muitos', 'muitas'];
      const temIndefinida = indefinidas.some(palavra => lowerMessage.includes(palavra));
      if (temIndefinida) {
        // Quantidade padrão para indefinidos (pode perguntar depois)
        quantity = 5; // Quantidade padrão
      }
    }
    
    // ============================================
    // ETAPA 2: REMOVER PALAVRAS DE AÇÃO (múltiplas variações)
    // ============================================
    let productName = lowerMessage;
    
    // Lista completa de palavras/frases de ação
    const acoes = [
      'quero', 'preciso', 'comprar', 'pedir', 'vou querer', 'gostaria de',
      'desejo', 'vou comprar', 'preciso de', 'queria', 'ia querer',
      'me manda', 'manda', 'pode ser', 'faz', 'me faz', 'faz pra mim',
      'pode me enviar', 'tem como', 'dá pra', 'dá pra fazer', 'dá pra me enviar',
      'seria possível', 'poderia', 'pode me mandar', 'me envia', 'envia',
      'vou pedir', 'vou comprar', 'quero comprar', 'preciso comprar',
      'quero pedir', 'preciso pedir', 'quero encomendar', 'preciso encomendar',
      'quero encomendar', 'preciso encomendar', 'quero fazer pedido',
      'preciso fazer pedido', 'quero fazer um pedido', 'preciso fazer um pedido',
      'quero fazer uma encomenda', 'preciso fazer uma encomenda',
      'quero fazer encomenda', 'preciso fazer encomenda',
      'quero fazer', 'preciso fazer', 'quero', 'preciso'
    ];
    
    // Remover palavras de ação (ordem importa - remover as mais longas primeiro)
    acoes.sort((a, b) => b.length - a.length);
    for (const acao of acoes) {
      const regex = new RegExp(`^${acao}\\s+`, 'i');
      productName = productName.replace(regex, '');
    }
    
    // Remover interjeições e palavras de cortesia
    productName = productName.replace(/^(por favor|pf|pfv|obrigado|obrigada|obg|vlw|valeu|tks|thanks)\s*/i, '');
    productName = productName.replace(/\s+(por favor|pf|pfv|obrigado|obrigada|obg|vlw|valeu|tks|thanks)\s*$/i, '');
    
    // ============================================
    // ETAPA 3: REMOVER QUANTIDADE DA STRING DO PRODUTO
    // ============================================
    
    // Remover número se ainda estiver na string
    if (quantity) {
      productName = productName.replace(new RegExp(`\\b${quantity}\\b`, 'g'), '');
    }
    
    // Remover números escritos por extenso
    for (const [palavra] of Object.entries(numerosExtenso)) {
      const regex = new RegExp(`\\b${palavra}\\b`, 'gi');
      productName = productName.replace(regex, '');
    }
    
    // Remover expressões de quantidade
    productName = productName.replace(/\b(duzia|dúzia|meia duzia|meia dúzia|quilo|kg|kilo|gramas?|g)\b/gi, '');
    productName = productName.replace(/\b(unidades?|unidade|un|peças?|peça|pç)\b/gi, '');
    
    // Remover palavras de quantidade indefinida
    productName = productName.replace(/\b(uns|umas|alguns|algumas|vários|várias|um monte|muitos|muitas)\b/gi, '');
    
    // ============================================
    // ETAPA 4: LIMPAR E NORMALIZAR NOME DO PRODUTO
    // ============================================
    
    // Remover artigos no início/fim (mas manter "de" no meio)
    productName = productName.replace(/^\s*(o|a|os|as|um|uma|d[eo]|d[ao]s|d[ae]s)\s+/gi, '');
    productName = productName.replace(/\s+(o|a|os|as|um|uma|d[eo]|d[ao]s|d[ae]s)\s*$/gi, '');
    
    // Remover preposições soltas (mas manter "de" quando faz parte do nome)
    productName = productName.replace(/\b(para|pra|com|sem|em|na|no|nas|nos)\b/gi, '');
    
    // Remover palavras de questionamento
    productName = productName.replace(/\b(qual|quais|que|quem|onde|quando|como|porque|por que)\b/gi, '');
    
    // Remover interrogações e exclamações
    productName = productName.replace(/[?!.,;:]+/g, '');
    
    // Limpar espaços múltiplos e normalizar
    productName = productName.trim().replace(/\s+/g, ' ');
    
    // Remover "de" solto no início/fim (mas manter no meio)
    productName = productName.replace(/^\s*de\s+/gi, '');
    productName = productName.replace(/\s+de\s*$/gi, '');
    
    // Normalizar diminutivos comuns (brigadinho → brigadeiro, bolinho → bolo)
    productName = productName.replace(/inho\b/gi, '');
    productName = productName.replace(/inha\b/gi, '');
    
    this.logger.debug(`ExtractOrderInfo: original="${message}", quantity=${quantity}, productName="${productName}"`);

    return {
      quantity,
      productName: productName && productName.length >= 2 ? productName : null,
    };
  }

  private findProductByName(produtos: any[], productName: string): { produto: any | null; sugestoes?: any[] } {
    if (!productName) return { produto: null };

    // Normalizar: remover acentos para busca mais flexível
    const normalize = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    const palavras = productName.toLowerCase().split(/\s+/).filter(p => p.length >= 2);
    
    if (palavras.length === 0) return { produto: null };

    // Estratégia 1: Buscar por nome exato (todas as palavras, sem acentos)
    let produto = produtos.find(p => {
      const nomeNormalizado = normalize(p.name);
      return palavras.every(palavra => {
        const palavraNormalizada = normalize(palavra);
        return nomeNormalizado.includes(palavraNormalizada);
      });
    });

    // Estratégia 2: Buscar por nome completo (query completa)
    if (!produto) {
      const queryCompleta = palavras.join(' ');
      produto = produtos.find(p => {
        const nomeNormalizado = normalize(p.name);
        return nomeNormalizado.includes(normalize(queryCompleta));
      });
    }

    // Estratégia 3: Buscar por qualquer palavra (se não encontrou)
    if (!produto) {
      produto = produtos.find(p => {
        const nomeNormalizado = normalize(p.name);
        return palavras.some(palavra => {
          const palavraNormalizada = normalize(palavra);
          return nomeNormalizado.includes(palavraNormalizada);
        });
      });
    }

    // Estratégia 4: Buscar por singular/plural (brigadeiro/brigadeiros, bolo/bolos)
    if (!produto && palavras.length === 1) {
      const palavra = palavras[0];
      const palavraNormalizada = normalize(palavra);
      
      // Tentar com 's' no final (plural)
      const plural = palavraNormalizada + 's';
      // Tentar sem 's' (singular)
      const singular = palavraNormalizada.endsWith('s') && palavraNormalizada.length > 4 
        ? palavraNormalizada.slice(0, -1) 
        : palavraNormalizada;
      
      produto = produtos.find(p => {
        const nomeNormalizado = normalize(p.name);
        // Buscar por palavra singular ou plural (incluindo no início do nome)
        return nomeNormalizado.includes(singular) || nomeNormalizado.includes(plural) || 
               nomeNormalizado.startsWith(singular + ' ') || nomeNormalizado.startsWith(plural + ' ') ||
               nomeNormalizado.startsWith(singular) || nomeNormalizado.startsWith(plural);
      });
    }

    // Estratégia 5: Busca por similaridade (erros de digitação comuns)
    if (!produto) {
      // Mapeamento de erros comuns de digitação
      const correcoes: Record<string, string[]> = {
        'brigadeiro': ['brigadeiro', 'brigadeiros', 'brigadinho', 'brigadinha'],
        'bolo': ['bolo', 'bolos', 'bolinho', 'bolinha'],
        'cenoura': ['cenoura', 'cenora', 'cenora'],
        'chocolate': ['chocolate', 'chocolat', 'chocolat'],
        'leite': ['leite', 'leite'],
        'ninho': ['ninho', 'nino'],
        'maracuja': ['maracuja', 'maracujá', 'maracuja'],
        'beijinho': ['beijinho', 'beijinho', 'beijinho'],
        'cajuzinho': ['cajuzinho', 'cajuzinho'],
        'coxinha': ['coxinha', 'coxinha'],
      };

      // Tentar correções
      for (const [original, variacoes] of Object.entries(correcoes)) {
        if (palavras.some(p => variacoes.some(v => normalize(p).includes(normalize(v))))) {
          produto = produtos.find(p => {
            const nomeNormalizado = normalize(p.name);
            return variacoes.some(v => nomeNormalizado.includes(normalize(v)));
          });
          if (produto) break;
        }
      }
    }

    // Se encontrou produto, retornar
    if (produto) {
      return { produto };
    }

    // Se não encontrou, buscar produtos similares (para sugestões)
    const sugestoes = this.findSimilarProducts(produtos, productName);
    
    return { produto: null, sugestoes: sugestoes.length > 0 ? sugestoes : undefined };
  }

  private findSimilarProducts(produtos: any[], productName: string, maxResults: number = 5): any[] {
    if (!productName || productName.length < 2) return [];

    const normalize = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    const queryNormalized = normalize(productName);
    const palavras = queryNormalized.split(/\s+/).filter(p => p.length >= 2);
    
    if (palavras.length === 0) return [];

    // Calcular similaridade para cada produto
    const produtosComScore = produtos.map(p => {
      const nomeNormalizado = normalize(p.name);
      let score = 0;

      // Score por palavras em comum
      palavras.forEach(palavra => {
        if (nomeNormalizado.includes(palavra)) {
          score += 10;
        }
        // Score por similaridade de caracteres (Levenshtein simplificado)
        if (palavra.length >= 3) {
          const similaridade = this.calculateSimilarity(palavra, nomeNormalizado);
          score += similaridade * 5;
        }
      });

      // Score por começar com a palavra
      palavras.forEach(palavra => {
        if (nomeNormalizado.startsWith(palavra)) {
          score += 5;
        }
      });

      // Score por conter todas as palavras (ordem não importa)
      if (palavras.every(palavra => nomeNormalizado.includes(palavra))) {
        score += 20;
      }

      return { produto: p, score };
    });

    // Filtrar produtos com score > 0 e ordenar por score
    return produtosComScore
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.produto);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Similaridade simples baseada em caracteres em comum
    const chars1 = new Set(str1.split(''));
    const chars2 = new Set(str2.split(''));
    
    let common = 0;
    chars1.forEach(char => {
      if (chars2.has(char)) common++;
    });

    const total = Math.max(chars1.size, chars2.size);
    return total > 0 ? common / total : 0;
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