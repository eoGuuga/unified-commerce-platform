# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - PARTE 3/8

## 🤖 INTEGRAÇÃO OPENAI EM CAMADAS

**Objetivo desta Parte:** Implementar processamento inteligente de mensagens WhatsApp usando OpenAI em camadas, otimizando custos e garantindo respostas rápidas e precisas.

**Tempo Estimado:** 2-3 semanas  
**Prioridade:** 🔴 CRÍTICA (funcionalidade principal - Bot com IA)

---

## 1. 📦 DEPENDÊNCIAS NECESSÁRIAS

### 1.1 Instalar Pacotes

```bash
cd backend
npm install openai @ai-sdk/openai zod
npm install --save-dev @types/node
```

**Pacotes:**
- `openai` - SDK oficial da OpenAI
- `@ai-sdk/openai` - Vercel AI SDK (opcional, mas útil)
- `zod` - Validação de esquemas (para extração estruturada)

### 1.2 Atualizar package.json

```json
{
  "dependencies": {
    "openai": "^4.20.0",
    "@ai-sdk/openai": "^0.0.50",
    "zod": "^3.22.4"
  }
}
```

---

## 2. 🏗️ ARQUITETURA EM CAMADAS

### 2.1 Visão Geral

```
MENSAGEM RECEBIDA
      ↓
┌─────────────────┐
│ CAMADA 1: Cache │ ← Verifica Redis primeiro (0 custo)
│   (Redis)       │
└────────┬────────┘
         │ Não encontrado
         ↓
┌─────────────────┐
│ CAMADA 2: Regex │ ← Respostas simples sem IA (0 custo)
│  (Hardcoded)    │
└────────┬────────┘
         │ Não encontrado
         ↓
┌─────────────────┐
│ CAMADA 3: OpenAI│ ← GPT-4o-mini (custo baixo)
│  (GPT-4o-mini)  │
└────────┬────────┘
         │ Se falhar ou custo alto
         ↓
┌─────────────────┐
│ CAMADA 4: GPT-4 │ ← Apenas casos complexos (custo alto)
│   (Fallback)    │
└─────────────────┘
```

### 2.2 Estratégia de Custos

- **Cache**: 0 custo, resposta instantânea
- **Regex**: 0 custo, resposta rápida
- **GPT-4o-mini**: ~$0.15/1M input tokens, ~$0.60/1M output tokens
- **GPT-4**: ~$5/1M input tokens, ~$15/1M output tokens (usar apenas quando necessário)

**Meta**: 70% cache, 20% regex, 9% GPT-4o-mini, 1% GPT-4

---

## 3. 🔧 SERVIÇO DE PROCESSAMENTO EM CAMADAS

### 3.1 Serviço Principal de Processamento

**Arquivo:** `backend/src/modules/whatsapp/services/ai-processor.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CacheService } from '../../../modules/common/services/cache.service';
import { UsageLogService } from '../../../modules/common/services/usage-log.service';
import { z } from 'zod';

// Schema para extração estruturada de intenções
const IntentSchema = z.object({
  intent: z.enum([
    'fazer_pedido',
    'consultar_produto',
    'consultar_estoque',
    'ver_cardapio',
    'cancelar_pedido',
    'status_pedido',
    'duvida',
    'reclamacao',
    'outro',
  ]),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    produto: z.string().optional(),
    quantidade: z.number().optional(),
    forma_pagamento: z.enum(['pix', 'credito', 'debito', 'dinheiro']).optional(),
    pedido_id: z.string().optional(),
  }).optional(),
  suggested_response: z.string().optional(),
});

type IntentResult = z.infer<typeof IntentSchema>;

@Injectable()
export class AIProcessorService {
  private readonly logger = new Logger(AIProcessorService.name);
  private openai: OpenAI | null = null;

  constructor(
    private configService: ConfigService,
    private cacheService: CacheService,
    private usageLogService: UsageLogService,
  ) {
    this.initializeOpenAI();
  }

  /**
   * Inicializa cliente OpenAI (global ou por tenant)
   */
  private async initializeOpenAI() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey,
    });

    this.logger.log('OpenAI client initialized');
  }

  /**
   * Inicializa cliente OpenAI para tenant específico (BYOK)
   */
  async initializeForTenant(
    tenantId: string,
    apiKey: string,
  ): Promise<void> {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log(`OpenAI client initialized for tenant ${tenantId}`);
    }
  }

  /**
   * Processa mensagem em camadas
   */
  async processMessage(
    tenantId: string,
    message: string,
    context?: Record<string, any>,
  ): Promise<IntentResult> {
    // CAMADA 1: Cache
    const cached = await this.tryCache(tenantId, message);
    if (cached) {
      this.logger.log('Response from cache');
      return cached;
    }

    // CAMADA 2: Regex simples
    const regexResult = await this.tryRegex(message);
    if (regexResult && regexResult.confidence > 0.7) {
      // Salva no cache para próxima vez
      await this.cacheService.cacheFaqResponse(
        tenantId,
        this.hashMessage(message),
        JSON.stringify(regexResult),
        24, // 24 horas
      );
      return regexResult;
    }

    // CAMADA 3: OpenAI GPT-4o-mini
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, using fallback');
      return this.fallbackResponse();
    }

    try {
      const aiResult = await this.tryOpenAI(
        tenantId,
        message,
        context,
        'gpt-4o-mini',
      );

      // Salva no cache
      await this.cacheService.cacheFaqResponse(
        tenantId,
        this.hashMessage(message),
        JSON.stringify(aiResult),
        24,
      );

      return aiResult;
    } catch (error) {
      this.logger.error(`OpenAI error: ${error}`);
      // CAMADA 4: Fallback para GPT-4 (se necessário) ou resposta padrão
      return this.fallbackResponse();
    }
  }

  /**
   * CAMADA 1: Tenta buscar no cache
   */
  private async tryCache(
    tenantId: string,
    message: string,
  ): Promise<IntentResult | null> {
    const messageHash = this.hashMessage(message);
    const cached = await this.cacheService.getCachedFaqResponse(
      tenantId,
      messageHash,
    );

    if (cached) {
      try {
        return JSON.parse(cached) as IntentResult;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * CAMADA 2: Processamento com regex (hardcoded)
   */
  private async tryRegex(message: string): Promise<IntentResult | null> {
    const lowerMessage = message.toLowerCase().trim();

    // Intenções simples com regex
    const patterns = {
      fazer_pedido: [
        /(?:quero|preciso|gostaria|vou querer|peço).*(?:brigadeiro|trufa|bolo|produto|doces?)/i,
        /(?:quanto|qual).*preço.*(?:brigadeiro|trufa)/i,
        /(?:tem|vocês têm|está disponível).*(?:brigadeiro|trufa)/i,
      ],
      ver_cardapio: [
        /(?:cardápio|menu|produtos?|o que vocês têm|o que tem)/i,
      ],
      status_pedido: [
        /(?:status|situação|como está).*pedido/i,
        /(?:meu pedido|pedido número)/i,
      ],
      cancelar_pedido: [
        /(?:cancelar|desistir|não quero mais).*pedido/i,
      ],
      duvida: [
        /(?:o que é|como funciona|explique|dúvida)/i,
      ],
    };

    for (const [intent, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        if (regex.test(message)) {
          return {
            intent: intent as IntentResult['intent'],
            confidence: 0.75,
            entities: this.extractEntitiesRegex(message),
          };
        }
      }
    }

    return null;
  }

  /**
   * Extrai entidades básicas com regex
   */
  private extractEntitiesRegex(message: string): IntentResult['entities'] {
    const lowerMessage = message.toLowerCase();

    // Extrai quantidade
    const quantityMatch = message.match(/(\d+)\s*(?:unidades?|un|brigadeiros?|trufas?)/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

    // Extrai produto
    const produtos = ['brigadeiro', 'trufa', 'bolo', 'doce'];
    const produto = produtos.find(p => lowerMessage.includes(p));

    // Extrai forma de pagamento
    const pagamentoMatch = lowerMessage.match(/(pix|cartão|crédito|débito|dinheiro)/i);
    const formaPagamento = pagamentoMatch
      ? (pagamentoMatch[1].toLowerCase() as 'pix' | 'credito' | 'debito' | 'dinheiro')
      : undefined;

    return {
      produto,
      quantidade: quantity,
      forma_pagamento: formaPagamento,
    };
  }

  /**
   * CAMADA 3: Processamento com OpenAI
   */
  private async tryOpenAI(
    tenantId: string,
    message: string,
    context: Record<string, any> = {},
    model: 'gpt-4o-mini' | 'gpt-4' = 'gpt-4o-mini',
  ): Promise<IntentResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Busca produtos disponíveis para contexto
    const produtosContext = context.produtos || [];
    const produtosList = produtosContext
      .map((p: any) => `- ${p.name}: R$ ${p.price}`)
      .join('\n');

    const systemPrompt = `Você é um assistente virtual de vendas para uma loja de doces artesanais.

PRODUTOS DISPONÍVEIS:
${produtosList || 'Produtos serão informados no contexto'}

FORMAS DE PAGAMENTO ACEITAS:
- PIX (preferencial, desconto 5%)
- Cartão de Crédito
- Cartão de Débito
- Dinheiro (para retirada)

INSTRUÇÕES:
1. Classifique a intenção da mensagem do cliente
2. Extraia entidades (produto, quantidade, forma de pagamento)
3. Seja amigável, direto e profissional
4. Se cliente quer fazer pedido, confirme produto e quantidade antes
5. Se cliente quer ver cardápio, liste produtos disponíveis
6. Se cliente quer saber preço, informe claramente

RESPOSTA EM JSON (use o schema fornecido):
{
  "intent": "fazer_pedido" | "consultar_produto" | "consultar_estoque" | "ver_cardapio" | "cancelar_pedido" | "status_pedido" | "duvida" | "reclamacao" | "outro",
  "confidence": 0.0-1.0,
  "entities": {
    "produto": "nome do produto",
    "quantidade": número,
    "forma_pagamento": "pix" | "credito" | "debito" | "dinheiro"
  },
  "suggested_response": "resposta sugerida para o cliente"
}`;

    const userPrompt = `Mensagem do cliente: "${message}"

Contexto da conversa: ${JSON.stringify(context)}`;

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Baixa temperatura para respostas mais determinísticas
        max_tokens: 500,
        response_format: { type: 'json_object' }, // Força resposta JSON
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Log uso para controle de custos
      const usage = response.usage;
      if (usage) {
        await this.usageLogService.logUsage(tenantId, {
          serviceType: 'openai_tokens',
          quantity: usage.total_tokens,
          costEstimated: this.calculateOpenAICost(
            model,
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
          ),
          metadata: {
            model,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
          },
        });
      }

      // Valida e parse resposta
      const parsed = JSON.parse(content);
      const validated = IntentSchema.parse(parsed);

      this.logger.log(
        `OpenAI processed intent: ${validated.intent} (confidence: ${validated.confidence})`,
      );

      return validated;
    } catch (error) {
      this.logger.error(`OpenAI processing error: ${error}`);
      throw error;
    }
  }

  /**
   * Calcula custo estimado do OpenAI
   */
  private calculateOpenAICost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    // Preços por 1M tokens (em centavos)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': {
        input: 15, // $0.15 / 1M = 0.00000015 por token
        output: 60, // $0.60 / 1M
      },
      'gpt-4': {
        input: 500, // $5 / 1M
        output: 1500, // $15 / 1M
      },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini'];

    const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
    const outputCost = (completionTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * CAMADA 4: Resposta de fallback
   */
  private fallbackResponse(): IntentResult {
    return {
      intent: 'duvida',
      confidence: 0.5,
      entities: {},
      suggested_response:
        'Desculpe, não entendi bem. Pode reformular? Posso ajudar com:\n- Fazer pedido\n- Ver cardápio\n- Consultar preços\n- Status do pedido',
    };
  }

  /**
   * Gera hash da mensagem para cache
   */
  private hashMessage(message: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(message.toLowerCase().trim())
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Gera resposta natural baseada no intent
   */
  async generateResponse(
    tenantId: string,
    intent: IntentResult,
    produtos: any[] = [],
    estoque: Record<string, number> = {},
  ): Promise<string> {
    // Se já tem resposta sugerida, usa ela
    if (intent.suggested_response) {
      return intent.suggested_response;
    }

    // Gera resposta baseada no intent
    switch (intent.intent) {
      case 'ver_cardapio':
        return this.generateCardapioResponse(produtos, estoque);

      case 'consultar_produto':
        return this.generateProdutoResponse(
          intent.entities?.produto || '',
          produtos,
          estoque,
        );

      case 'fazer_pedido':
        return this.generatePedidoResponse(intent.entities, produtos, estoque);

      case 'status_pedido':
        return 'Para consultar o status do seu pedido, preciso do número do pedido. Você tem o número?';

      case 'cancelar_pedido':
        return 'Para cancelar seu pedido, preciso do número do pedido. Você tem o número?';

      default:
        return 'Como posso ajudar você hoje? Posso:\n- Mostrar nosso cardápio\n- Ajudar a fazer um pedido\n- Informar preços\n- Verificar status de pedido';
    }
  }

  /**
   * Gera resposta de cardápio
   */
  private generateCardapioResponse(
    produtos: any[],
    estoque: Record<string, number>,
  ): string {
    if (produtos.length === 0) {
      return 'No momento não temos produtos cadastrados.';
    }

    let response = '🍰 *NOSSO CARDÁPIO*\n\n';

    produtos.forEach((produto) => {
      const stock = estoque[produto.id] || 0;
      const emoji = stock > 0 ? '✅' : '❌';
      response += `${emoji} *${produto.name}*\n`;
      response += `   R$ ${parseFloat(produto.price).toFixed(2)}\n`;
      response += `   Estoque: ${stock > 0 ? stock + ' unidades' : 'Indisponível'}\n\n`;
    });

    response += 'Para fazer um pedido, digite: "Quero [quantidade] [produto]"';
    return response;
  }

  /**
   * Gera resposta sobre produto específico
   */
  private generateProdutoResponse(
    produtoNome: string,
    produtos: any[],
    estoque: Record<string, number>,
  ): string {
    const produto = produtos.find(
      (p) => p.name.toLowerCase().includes(produtoNome.toLowerCase()),
    );

    if (!produto) {
      return `Não encontrei o produto "${produtoNome}". Digite "cardápio" para ver nossos produtos.`;
    }

    const stock = estoque[produto.id] || 0;

    let response = `*${produto.name}*\n\n`;
    response += `💰 Preço: R$ ${parseFloat(produto.price).toFixed(2)}\n`;
    response += `📦 Estoque: ${stock > 0 ? stock + ' unidades' : 'Indisponível'}\n`;

    if (produto.description) {
      response += `\n📝 ${produto.description}\n`;
    }

    if (stock > 0) {
      response += '\n✅ Produto disponível! Para pedir, digite: "Quero [quantidade] [produto]"';
    }

    return response;
  }

  /**
   * Gera resposta para fazer pedido
   */
  private generatePedidoResponse(
    entities: IntentResult['entities'],
    produtos: any[],
    estoque: Record<string, number>,
  ): string {
    const produto = produtos.find(
      (p) =>
        entities?.produto &&
        p.name.toLowerCase().includes(entities.produto.toLowerCase()),
    );

    if (!produto) {
      return `Não encontrei o produto "${entities?.produto}". Digite "cardápio" para ver nossos produtos.`;
    }

    const stock = estoque[produto.id] || 0;
    const quantidade = entities?.quantidade || 1;

    if (stock < quantidade) {
      return `Desculpe, temos apenas ${stock} unidades de ${produto.name} em estoque. Deseja outra quantidade?`;
    }

    const total = quantidade * parseFloat(produto.price);
    const descontoPix = total * 0.05; // 5% desconto no PIX
    const totalPix = total - descontoPix;

    let response = `✅ *PEDIDO CONFIRMADO*\n\n`;
    response += `📦 ${quantidade}x ${produto.name}\n`;
    response += `💰 Total: R$ ${total.toFixed(2)}\n`;
    response += `💳 Com PIX: R$ ${totalPix.toFixed(2)} (5% desconto)\n\n`;
    response += `Como prefere pagar?\n`;
    response += `1️⃣ PIX\n`;
    response += `2️⃣ Cartão de Crédito\n`;
    response += `3️⃣ Cartão de Débito\n`;
    response += `4️⃣ Dinheiro (retirada)`;

    return response;
  }
}
```

---

## 4. 🔗 INTEGRAÇÃO COM WHATSAPPSERVICE

### 4.1 Atualizar WhatsappService

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.service.ts`

```typescript
// ... imports existentes ...
import { AIProcessorService } from './services/ai-processor.service';
import { ConversationService } from './services/conversation.service';

@Injectable()
export class WhatsappService {
  // ... código existente ...

  constructor(
    private config: ConfigService,
    private openAIService: OpenAIService, // Manter para compatibilidade
    private aiProcessor: AIProcessorService, // Novo
    private conversationService: ConversationService, // Novo
    private cacheService: CacheService,
    private productsService: ProductsService, // Precisa injetar
  ) {}

  async processIncomingMessage(message: WhatsappMessage): Promise<void> {
    this.logger.log(`Processing message from ${message.from}: ${message.body}`);

    try {
      // Identifica tenant (pode ser por número do WhatsApp ou contexto)
      const tenantId = await this.identifyTenant(message.from);
      if (!tenantId) {
        this.logger.warn(`Tenant not found for ${message.from}`);
        await this.sendMessage(
          message.from,
          'Desculpe, não encontrei sua loja. Entre em contato com suporte.',
        );
        return;
      }

      // Busca ou cria conversa
      const conversation = await this.conversationService.getOrCreateConversation(
        tenantId,
        message.from,
      );

      // Busca produtos e estoque para contexto
      const produtos = await this.productsService.findAll(tenantId);
      const estoque: Record<string, number> = {};
      for (const produto of produtos) {
        const stock = await this.getStock(tenantId, produto.id);
        estoque[produto.id] = stock;
      }

      // Busca contexto da conversa
      const context = {
        conversationId: conversation.id,
        ...conversation.context,
        produtos: produtos.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
        })),
      };

      // Processa mensagem com IA em camadas
      const intent = await this.aiProcessor.processMessage(
        tenantId,
        message.body,
        context,
      );

      // Gera resposta
      const response = await this.aiProcessor.generateResponse(
        tenantId,
        intent,
        produtos,
        estoque,
      );

      // Salva mensagem recebida
      await this.conversationService.saveMessage(
        conversation.id,
        'inbound',
        message.body,
        'text',
      );

      // Envia resposta
      await this.sendMessage(message.from, response);

      // Salva mensagem enviada
      await this.conversationService.saveMessage(
        conversation.id,
        'outbound',
        response,
        'text',
      );

      // Atualiza contexto se necessário
      if (intent.entities) {
        await this.conversationService.updateContext(conversation.id, {
          lastIntent: intent.intent,
          ...intent.entities,
        });
      }

      // Atualiza timestamp da conversa
      conversation.last_message_at = new Date();
      await this.conversationService.updateLastMessage(conversation.id);

      this.logger.log(
        `Response sent: ${intent.intent} (confidence: ${intent.confidence})`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Envia mensagem de erro amigável
      await this.sendMessage(
        message.from,
        'Desculpe, tive um problema. Tente novamente em alguns segundos.',
      );
    }
  }

  /**
   * Identifica tenant pelo número do WhatsApp
   * (pode ser por configuração ou histórico de conversas)
   */
  private async identifyTenant(phone: string): Promise<string | null> {
    // TODO: Implementar lógica de identificação
    // Por enquanto, retorna tenant padrão (deve vir da configuração)
    return this.config.get<string>('DEFAULT_TENANT_ID') || null;
  }

  /**
   * Busca estoque de um produto
   */
  private async getStock(tenantId: string, productId: string): Promise<number> {
    // Verifica cache primeiro
    const cached = await this.cacheService.getCachedStock(tenantId, productId);
    if (cached !== null) {
      return cached;
    }

    // Busca no banco
    // TODO: Implementar busca real de estoque
    return 0;
  }
}
```

---

## 5. 🧪 TESTES

### 5.1 Testes Unitários

**Arquivo:** `backend/src/modules/whatsapp/services/ai-processor.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AIProcessorService } from './ai-processor.service';
import { CacheService } from '../../../modules/common/services/cache.service';
import { UsageLogService } from '../../../modules/common/services/usage-log.service';
import { ConfigService } from '@nestjs/config';

describe('AIProcessorService', () => {
  let service: AIProcessorService;
  let cacheService: CacheService;
  let usageLogService: UsageLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIProcessorService,
        {
          provide: CacheService,
          useValue: {
            getCachedFaqResponse: jest.fn(),
            cacheFaqResponse: jest.fn(),
          },
        },
        {
          provide: UsageLogService,
          useValue: {
            logUsage: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return 'test-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AIProcessorService>(AIProcessorService);
    cacheService = module.get<CacheService>(CacheService);
    usageLogService = module.get<UsageLogService>(UsageLogService);
  });

  describe('processMessage', () => {
    it('should return cached response if available', async () => {
      const cachedResult = {
        intent: 'ver_cardapio',
        confidence: 0.9,
      };

      jest
        .spyOn(cacheService, 'getCachedFaqResponse')
        .mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.processMessage('tenant-1', 'cardápio');

      expect(result.intent).toBe('ver_cardapio');
      expect(cacheService.getCachedFaqResponse).toHaveBeenCalled();
    });

    it('should use regex for simple intents', async () => {
      jest.spyOn(cacheService, 'getCachedFaqResponse').mockResolvedValue(null);

      const result = await service.processMessage('tenant-1', 'quero 3 brigadeiros');

      expect(result.intent).toBe('fazer_pedido');
      expect(result.entities?.quantidade).toBe(3);
      expect(result.entities?.produto).toContain('brigadeiro');
    });
  });
});
```

---

## 6. ✅ CHECKLIST DE IMPLEMENTAÇÃO - PARTE 3

### 6.1 Dependências
- [ ] Instalar `openai`, `@ai-sdk/openai`, `zod`
- [ ] Atualizar `package.json`

### 6.2 Serviço de Processamento
- [ ] Criar `AIProcessorService`
- [ ] Implementar camada de cache
- [ ] Implementar camada de regex
- [ ] Implementar camada OpenAI (GPT-4o-mini)
- [ ] Implementar fallback (GPT-4 ou resposta padrão)

### 6.3 Integração
- [ ] Integrar `AIProcessorService` com `WhatsappService`
- [ ] Adicionar logging de uso (custo OpenAI)
- [ ] Testar fluxo completo

### 6.4 Testes
- [ ] Testar cache (deve retornar instantâneo)
- [ ] Testar regex (intenções simples)
- [ ] Testar OpenAI (intenções complexas)
- [ ] Testar fallback (quando OpenAI falha)

### 6.5 Configuração
- [ ] Adicionar `OPENAI_API_KEY` no `.env`
- [ ] Configurar modelo padrão (gpt-4o-mini)
- [ ] Configurar limites de tokens
- [ ] Configurar temperatura

---

## 7. 📝 PRÓXIMOS PASSOS (Após Parte 3)

**PARTE 4:** Fluxo Completo WhatsApp Bot
- Processamento de pedidos via WhatsApp
- Geração QR Code Pix
- Integração com OrdersService
- Fluxo completo de compra

---

**Status:** ✅ PARTE 3 COMPLETA  
**Próxima Parte:** PARTE 4 - Fluxo Completo WhatsApp Bot
