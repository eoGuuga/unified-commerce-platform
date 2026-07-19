import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { BotConfig } from './bot-config.service';
import { ConversationState } from '../types/whatsapp.types';

export type RouterAction =
  | 'show_catalog'
  | 'process_order'
  | 'check_price'
  | 'check_stock'
  | 'check_order_status'
  | 'cancel_order'
  | 'select_payment'
  | 'start_checkout'
  | 'collect_info'
  | 'answer_question'
  | 'greeting'
  | 'farewell'
  | 'clarify'
  | 'handoff_human';

export interface RouterDecision {
  action: RouterAction;
  params: Record<string, any>;
  confidence: number;
}

export interface RouterInput {
  message: string;
  botConfig: BotConfig;
  catalogSummary: string[];
  currentState: ConversationState | null;
  recentMessages: string[];
  customerName?: string | null;
  pendingOrderSummary?: string | null;
}

@Injectable()
export class LLMRouterService {
  private readonly logger = new Logger(LLMRouterService.name);

  constructor(private readonly openAIService: OpenAIService) {}

  async route(input: RouterInput): Promise<RouterDecision> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.buildSystemPrompt(input);
      const userPrompt = this.buildUserPrompt(input);

      const decision = await this.openAIService.routeMessage(
        systemPrompt,
        userPrompt,
        input.botConfig.model,
        input.botConfig.temperature,
      );

      const latencyMs = Date.now() - startTime;
      this.logger.log('Router decision', {
        action: decision.action,
        confidence: decision.confidence,
        latencyMs,
        message: input.message.substring(0, 80),
      });

      return decision;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.warn('Router failed, using clarify fallback', {
        error: error instanceof Error ? error.message : String(error),
        latencyMs,
      });

      return {
        action: 'clarify',
        params: { reason: 'llm_error' },
        confidence: 0,
      };
    }
  }

  private buildSystemPrompt(input: RouterInput): string {
    const { botConfig, catalogSummary, currentState, pendingOrderSummary } = input;
    const { persona, store, rules } = botConfig;

    const sections: string[] = [
      `Voce e o roteador de intencoes do bot "${persona.name}" — ${persona.role} da ${store.name}.`,
      `${store.description}.`,
      '',
      'SUA FUNCAO: analisar a mensagem do cliente e decidir qual ACAO o sistema deve executar.',
      'Voce NAO gera resposta ao cliente. Voce apenas classifica a intencao e extrai parametros.',
      '',
      '=== ACOES DISPONIVEIS ===',
      '',
      'show_catalog — Cliente quer ver produtos/cardapio/menu. Params: {}',
      'process_order — Cliente quer comprar algo. Params: { "product": "nome", "quantity": numero_ou_null }',
      'check_price — Cliente pergunta preco de algo. Params: { "product": "nome" }',
      'check_stock — Cliente pergunta disponibilidade/estoque. Params: { "product": "nome" }',
      'check_order_status — Cliente quer saber status de pedido. Params: { "order_number": "PED-..." ou null }',
      'cancel_order — Cliente quer cancelar pedido. Params: { "order_number": "PED-..." ou null }',
      'select_payment — Cliente escolheu forma de pagamento. Params: { "method": "pix" ou "dinheiro" ou "cartao" }',
      'start_checkout — Cliente quer FECHAR/finalizar o pedido ja montado ("e isso", "pode fechar", "finaliza"). Params: {}',
      'answer_question — Cliente fez pergunta sobre a loja, produtos, entrega, etc. Params: { "topic": "descricao curta" }',
      'greeting — Cliente cumprimentou (oi, boa noite, etc). Params: {}',
      'farewell — Cliente se despediu (tchau, obrigado, etc). Params: {}',
      'clarify — Mensagem ambigua, precisa pedir esclarecimento. Params: { "reason": "motivo curto" }',
      'handoff_human — Cliente pede atendente humano ou tem problema grave. Params: { "reason": "motivo" }',
      '',
      '=== CATALOGO ATUAL ===',
      '',
    ];

    if (catalogSummary.length > 0) {
      sections.push(...catalogSummary.map((line) => `- ${line}`));
    } else {
      sections.push('(catalogo vazio — nenhum produto cadastrado)');
    }

    sections.push('');
    sections.push('=== CONTEXTO DA CONVERSA ===');
    sections.push('');
    sections.push(`Estado atual: ${currentState || 'idle'}`);

    if (pendingOrderSummary) {
      sections.push(`Pedido em andamento: ${pendingOrderSummary}`);
    }

    sections.push('');
    sections.push(`Meios de pagamento: ${store.payment_methods.join(', ')}`);
    sections.push(`Opcoes de entrega: ${store.delivery_options.join(', ')}`);
    sections.push(`Horario: ${store.business_hours}`);

    sections.push('');
    sections.push('=== REGRAS ===');
    sections.push('');
    rules.forEach((rule) => sections.push(`- ${rule}`));

    sections.push('');
    sections.push('=== INSTRUCOES DE CLASSIFICACAO ===');
    sections.push('');
    sections.push('- Seja generoso ao interpretar intencao de compra. "manda brigadeiro", "quero brig", "me ve 2" sao process_order.');
    sections.push('- Girias, abreviacoes e erros de digitacao sao normais. "qro", "qnto", "brig", "dinhero" devem ser interpretados.');
    sections.push('- Se o cliente menciona "cardapio", "menu", "opcoes", "o que tem" → show_catalog.');
    sections.push('- Se o cliente pergunta "quanto custa", "qual o preco", "quanto ta" → check_price.');
    sections.push('- Se a mensagem e apenas uma saudacao sem pedido embutido → greeting.');
    sections.push('- Se a mensagem mistura saudacao + pedido ("boa noite quero 2 brigadeiros") → process_order (ignore a saudacao).');
    sections.push('- "e isso", "so isso", "pode fechar", "finaliza ai", "quero finalizar" (SEM novo item) → start_checkout. NAO confunda com process_order: "quero X" = ADICIONAR o item X; fechar e quando o cliente ENCERRA a escolha.');
    sections.push('- Se a mensagem e ambigua demais para classificar com seguranca → clarify.');
    sections.push('- confidence deve refletir sua certeza: 0.9+ para intencoes claras, 0.5-0.7 para inferencias, <0.5 para chutes.');

    return sections.join('\n');
  }

  private buildUserPrompt(input: RouterInput): string {
    const parts: string[] = [];

    if (input.recentMessages.length > 0) {
      parts.push('Ultimas mensagens da conversa:');
      input.recentMessages.forEach((msg) => parts.push(msg));
      parts.push('');
    }

    parts.push(`Mensagem atual do cliente: "${input.message}"`);

    if (input.customerName) {
      parts.push(`Nome do cliente: ${input.customerName}`);
    }

    parts.push('');
    parts.push('Retorne SOMENTE o JSON com action, params e confidence.');

    return parts.join('\n');
  }
}
