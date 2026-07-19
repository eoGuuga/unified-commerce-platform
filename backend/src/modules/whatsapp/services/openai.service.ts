import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageIntelligenceService } from './message-intelligence.service';
import { RouterDecision } from './llm-router.service';
import {
  ConversationResponseMode,
  ConversationSalesPreferenceProfile,
} from '../types/whatsapp.types';

export interface MessageIntent {
  intent: 'consultar' | 'fazer_pedido' | 'cancelar' | 'outro';
  product?: string;
  quantity?: number;
  confidence: number;
}

/**
 * Resultado de uma chamada com function-calling NATIVO (Fatia 0 do tool-calling
 * pleno). O LLM ou pede uma ferramenta (`tool_calls`) ou dá a narração final
 * (`content`). O chamador (o loop, Fatia 1+) discrimina pelo `kind`.
 */
export type ToolCallingResult =
  | {
      kind: 'tool_calls';
      toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>;
    }
  | { kind: 'content'; content: string };

export interface ConversationalAssistInput {
  message: string;
  currentState?: string | null;
  stageLabel?: string | null;
  catalogSummary?: string[];
  memory?: {
    lastIntent?: string | null;
    lastProductName?: string | null;
    lastProductNames?: string[] | null;
    lastCustomerGoal?: string | null;
    salesPreferenceProfile?: ConversationSalesPreferenceProfile | null;
  } | null;
  storeContext?: {
    storeName?: string | null;
    storePersona?: string | null;
    storeLabel?: string | null;
    catalogReading?: string | null;
    qualificationQuestion?: string | null;
    focusThemes?: string[] | null;
    paymentMethods?: string[] | null;
    operationRules?: string[] | null;
  } | null;
}

export interface ConversationalAssistResult {
  safeReply: string;
  confidence: number;
  detectedGoal: string;
  detectedEmotion: 'neutral' | 'confused' | 'frustrated' | 'hesitant' | 'urgent';
  shouldStayInCurrentStage: boolean;
  mentionsProduct?: string;
  responseMode?: ConversationResponseMode;
  salesPreferenceProfile?: ConversationSalesPreferenceProfile | null;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(
    private config: ConfigService,
    private messageIntelligenceService: MessageIntelligenceService,
  ) {}

  async processMessage(message: string): Promise<MessageIntent> {
    const { apiKey, baseUrl, model, timeoutMs, allowNoKey } = this.getClientConfig();
    if (!apiKey && !allowNoKey) {
      this.logger.warn('OpenAI API key not configured, using fallback');
      return this.fallbackProcessing(message);
    }

    try {
      const content = await this.callChatCompletions({
        apiKey,
        baseUrl,
        timeoutMs,
        body: {
          model,
          temperature: 0,
          max_tokens: 140,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'message_intent',
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  intent: {
                    type: 'string',
                    enum: ['consultar', 'fazer_pedido', 'cancelar', 'outro'],
                  },
                  product: {
                    type: ['string', 'null'],
                  },
                  quantity: {
                    type: ['number', 'null'],
                  },
                  confidence: {
                    type: 'number',
                  },
                },
                required: ['intent', 'product', 'quantity', 'confidence'],
              },
            },
          },
          messages: [
            {
              role: 'system',
              content: [
                'Voce classifica mensagens de WhatsApp em portugues brasileiro para um assistente de vendas de loja.',
                'Retorne SOMENTE JSON valido.',
                'Contexto: clientes enviam mensagens informais, com abreviacoes, girias e erros de digitacao.',
                'Use intent="fazer_pedido" quando houver intencao clara de compra (ex: "quero", "manda", "me ve", "preciso de", quantidade + produto).',
                'Use intent="consultar" para perguntas sobre preco, estoque, catalogo, cardapio, opcoes disponiveis.',
                'Use intent="cancelar" SOMENTE para intencao explicita de cancelamento de pedido.',
                'Use intent="outro" para saudacoes, agradecimentos, mensagens fora de contexto comercial, ou quando nao for seguro inferir.',
                'Nunca invente produtos ou quantidades quando incerto.',
                'Seja generoso ao interpretar intencao de compra - "tem brigadeiro?" pode ser consultar, "manda brigadeiro" e fazer_pedido.',
              ].join(' '),
            },
            { role: 'user', content: message },
          ],
        },
      });
      if (!content || typeof content !== 'string') {
        return this.fallbackProcessing(message);
      }

      try {
        const parsed = JSON.parse(content);
        if (parsed && parsed.intent) {
          return {
            intent: parsed.intent,
            product: parsed.product || undefined,
            quantity: typeof parsed.quantity === 'number' ? parsed.quantity : undefined,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          };
        }
      } catch {
        // fall through
      }
      return this.fallbackProcessing(message);
    } catch (error) {
      this.logger.warn('OpenAI request failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallbackProcessing(message);
    }
  }

  async generateConversationalAssist(
    input: ConversationalAssistInput,
  ): Promise<ConversationalAssistResult | null> {
    const enabled =
      String(this.config.get('WHATSAPP_LLM_ASSIST_ENABLED') || '').toLowerCase() === 'true';
    if (!enabled) {
      return null;
    }

    const { apiKey, baseUrl, model, allowNoKey } = this.getClientConfig();
    const timeoutMs = Number(this.config.get('WHATSAPP_LLM_ASSIST_TIMEOUT_MS') || 2500);
    if (!apiKey && !allowNoKey) {
      return null;
    }

    try {
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          safeReply: { type: 'string' },
          confidence: { type: 'number' },
          detectedGoal: { type: 'string' },
          detectedEmotion: {
            type: 'string',
            enum: ['neutral', 'confused', 'frustrated', 'hesitant', 'urgent'],
          },
          shouldStayInCurrentStage: { type: 'boolean' },
          mentionsProduct: { type: ['string', 'null'] },
          responseMode: {
            type: ['string', 'null'],
            enum: [
              'step_guidance',
              'issue_recovery',
              'context_recap',
              'post_order_support',
              'handoff_ready',
              'sales_consultative',
              'decision_coaching',
              'trust_reassurance',
              'freeform_support',
              null,
            ],
          },
          salesPreferenceProfile: {
            type: ['object', 'null'],
            additionalProperties: false,
            properties: {
              occasion: {
                type: ['string', 'null'],
                enum: ['gift', 'visit', 'coffee', 'dessert', 'sharing', 'self_treat', 'chocolate_focus', null],
              },
              style: {
                type: ['string', 'null'],
                enum: ['delicate', 'safe', 'premium', 'simple', null],
              },
              taste: {
                type: ['string', 'null'],
                enum: ['less_sweet', 'creamy', 'chocolate_focus', null],
              },
              recipientHint: {
                type: ['string', 'null'],
              },
            },
            required: ['occasion', 'style', 'taste', 'recipientHint'],
          },
        },
        required: [
          'safeReply',
          'confidence',
          'detectedGoal',
          'detectedEmotion',
          'shouldStayInCurrentStage',
          'mentionsProduct',
          'responseMode',
          'salesPreferenceProfile',
        ],
      } as const;

      const catalogSummary = (input.catalogSummary || [])
        .map((line) => `- ${line}`)
        .join('\n');
      const memory = input.memory || null;
      const storeContext = input.storeContext || null;
      const isLoucasStore =
        String(storeContext?.storePersona || '').trim().toLowerCase() === 'loucas_brigadeiro' ||
        String(storeContext?.storeName || '')
          .trim()
          .toLowerCase()
          .includes('loucas por brigadeiro');
      const memoryLines = [
        memory?.lastIntent ? `- ultima_intencao: ${memory.lastIntent}` : null,
        memory?.lastProductName ? `- ultimo_produto: ${memory.lastProductName}` : null,
        memory?.lastProductNames?.length
          ? `- ultimos_produtos: ${memory.lastProductNames.join(', ')}`
          : null,
        memory?.lastCustomerGoal ? `- ultimo_objetivo: ${memory.lastCustomerGoal}` : null,
        memory?.salesPreferenceProfile?.occasion
          ? `- preferencia_ocasião: ${memory.salesPreferenceProfile.occasion}`
          : null,
        memory?.salesPreferenceProfile?.style
          ? `- preferencia_estilo: ${memory.salesPreferenceProfile.style}`
          : null,
        memory?.salesPreferenceProfile?.taste
          ? `- preferencia_sabor: ${memory.salesPreferenceProfile.taste}`
          : null,
        memory?.salesPreferenceProfile?.recipientHint
          ? `- referencia_destinatario: ${memory.salesPreferenceProfile.recipientHint}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');
      const storeContextLines = [
        storeContext?.storeName ? `loja: ${storeContext.storeName}` : null,
        storeContext?.storeLabel ? `linha_comercial_da_loja: ${storeContext.storeLabel}` : null,
        storeContext?.catalogReading
          ? `leitura_catalogo_loja: ${storeContext.catalogReading}`
          : null,
        storeContext?.qualificationQuestion
          ? `pergunta_consultiva_preferida: ${storeContext.qualificationQuestion}`
          : null,
        storeContext?.focusThemes?.length
          ? `focos_comerciais: ${storeContext.focusThemes.join(', ')}`
          : null,
        storeContext?.paymentMethods?.length
          ? `meios_pagamento_disponiveis_no_whatsapp: ${storeContext.paymentMethods.join(', ')}`
          : null,
        storeContext?.operationRules?.length
          ? `regras_operacionais:\n${storeContext.operationRules.map((rule) => `- ${rule}`).join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      const content = await this.callChatCompletions({
        apiKey,
        baseUrl,
        timeoutMs,
        body: {
          model,
          temperature: 0.15,
          max_tokens: 220,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'whatsapp_conversational_assist',
              schema,
            },
          },
          messages: [
            {
              role: 'system',
              content: [
                'Voce e uma vendedora de WhatsApp em portugues do Brasil, humana, calma, consultiva e objetiva.',
                'Sua funcao aqui NAO e executar pedido, pagamento ou estoque. Sua funcao e entender melhor a mensagem e gerar a resposta mais segura e natural possivel.',
                'Nunca invente produtos, precos, politicas, formas de pagamento, entrega ou estoque.',
                isLoucasStore
                  ? 'Voce atende exclusivamente a Loucas por Brigadeiro. Seu universo e vender os produtos reais da Loucas, especialmente brigadeiros, sobremesas cremosas, presentes e combinacoes desse catalogo.'
                  : 'Voce atende exclusivamente a loja enviada no contexto, sempre se limitando ao catalogo real fornecido.',
                isLoucasStore
                  ? 'Quando a pessoa falar uma linha da loja, como brigadeiros tradicionais, pense primeiro na familia real de opcoes da Loucas antes de colapsar tudo em um SKU aleatorio.'
                  : 'Quando houver ambiguidade de produto, nao chute SKU especifico sem base suficiente.',
                isLoucasStore
                  ? 'Soe como uma vendedora forte da Loucas por Brigadeiro: acolhedora, segura, comercial e muito focada no que combina melhor com a situacao do cliente.'
                  : 'Soe como uma vendedora forte da loja, humana e segura.',
                'Se houver etapa transacional ativa, preserve a etapa e explique com naturalidade o que falta.',
                'Se a mensagem for fora de contexto, emocional ou estranha, responda com humanidade e traga a conversa de volta sem soar como menu.',
                'Responda em no maximo 4 linhas curtas. Nada de markdown, JSON ou listas grandes no campo safeReply.',
              ].join(' '),
            },
            {
              role: 'user',
              content: [
                `mensagem_cliente: ${input.message}`,
                `etapa_atual: ${input.currentState || 'idle'}`,
                `rotulo_etapa: ${input.stageLabel || 'nenhum'}`,
                storeContextLines
                  ? `contexto_loja:\n${storeContextLines}`
                  : 'contexto_loja: sem contexto adicional da loja',
                memoryLines ? `memoria_recente:\n${memoryLines}` : 'memoria_recente: sem memoria relevante',
                catalogSummary
                  ? `catalogo_real_resumido:\n${catalogSummary}`
                  : 'catalogo_real_resumido: sem resumo de catalogo',
                'Gere SOMENTE o JSON pedido.',
              ].join('\n\n'),
            },
          ],
        },
      });

      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as Partial<ConversationalAssistResult>;
      const safeReply = this.sanitizeConversationalReply(parsed.safeReply);
      const confidence = Number(parsed.confidence ?? 0);
      const detectedGoal = String(parsed.detectedGoal || '').trim();
      const detectedEmotion = String(parsed.detectedEmotion || 'neutral') as
        | 'neutral'
        | 'confused'
        | 'frustrated'
        | 'hesitant'
        | 'urgent';
      const responseMode = parsed.responseMode
        ? (String(parsed.responseMode) as ConversationResponseMode)
        : undefined;
      const salesPreferenceProfile = this.sanitizeSalesPreferenceProfile(
        parsed.salesPreferenceProfile,
      );

      if (!safeReply || !detectedGoal || Number.isNaN(confidence)) {
        return null;
      }

      return {
        safeReply,
        confidence: Math.max(0, Math.min(1, confidence)),
        detectedGoal,
        detectedEmotion,
        shouldStayInCurrentStage: Boolean(parsed.shouldStayInCurrentStage),
        mentionsProduct: parsed.mentionsProduct ? String(parsed.mentionsProduct) : undefined,
        responseMode,
        salesPreferenceProfile,
      };
    } catch (error) {
      this.logger.warn('Conversational assist request failed, keeping deterministic fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private fallbackProcessing(message: string): MessageIntent {
    const analysis = this.messageIntelligenceService.analyze(message);

    if (analysis.flags.needsClarification || analysis.flags.lowSignal) {
      return {
        intent: 'outro',
        confidence: analysis.confidence,
      };
    }

    if (analysis.primaryIntent === 'cancelar') {
      return {
        intent: 'cancelar',
        confidence: analysis.confidence,
      };
    }

    if (analysis.primaryIntent === 'fazer_pedido') {
      return {
        intent: 'fazer_pedido',
        product: analysis.productCandidate || undefined,
        quantity: analysis.quantity || undefined,
        confidence: analysis.confidence,
      };
    }

    return {
      intent: 'consultar',
      product: analysis.productCandidate || undefined,
      quantity: analysis.quantity || undefined,
      confidence: analysis.confidence,
    };
  }

  async routeMessage(
    systemPrompt: string,
    userPrompt: string,
    model?: string,
    temperature?: number,
  ): Promise<RouterDecision> {
    const { apiKey, baseUrl, timeoutMs, allowNoKey, model: defaultModel } = this.getClientConfig();
    if (!apiKey && !allowNoKey) {
      throw new Error('OpenAI API key not configured');
    }

    const content = await this.callChatCompletions({
      apiKey,
      baseUrl,
      timeoutMs,
      body: {
        model: model || defaultModel,
        temperature: temperature ?? 0.3,
        max_tokens: 200,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'router_decision',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                action: { type: 'string' },
                params: { type: 'object' },
                confidence: { type: 'number' },
              },
              required: ['action', 'params', 'confidence'],
            },
          },
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
    });

    if (!content) {
      throw new Error('Empty response from LLM router');
    }

    const parsed = JSON.parse(content);
    return {
      action: parsed.action,
      params: parsed.params || {},
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  }

  async generateTextReply(
    systemPrompt: string,
    model?: string,
    temperature?: number,
  ): Promise<string | null> {
    const { apiKey, baseUrl, timeoutMs, allowNoKey, model: defaultModel } = this.getClientConfig();
    if (!apiKey && !allowNoKey) {
      return null;
    }

    const content = await this.callChatCompletions({
      apiKey,
      baseUrl,
      timeoutMs,
      body: {
        model: model || defaultModel,
        temperature: temperature ?? 0.5,
        max_tokens: 250,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Gere a resposta.' },
        ],
      },
    });

    if (!content) {
      return null;
    }

    return content.replace(/^["']|["']$/g, '').trim().slice(0, 600);
  }

  private getClientConfig() {
    return {
      apiKey: this.config.get('OPENAI_API_KEY'),
      baseUrl: (this.config.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').trim(),
      model: this.config.get('OPENAI_MODEL') || 'gpt-4o-mini',
      timeoutMs: Number(this.config.get('OPENAI_TIMEOUT_MS') || 8000),
      allowNoKey: String(this.config.get('OPENAI_ALLOW_NO_KEY') || '').toLowerCase() === 'true',
    };
  }

  private async callChatCompletions(input: {
    apiKey?: string;
    baseUrl: string;
    timeoutMs: number;
    body: Record<string, unknown>;
  }): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      }

      let response: Response | null = null;
      const body = JSON.stringify(input.body);

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        response = await fetch(`${input.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
        if (response.ok) {
          break;
        }
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      if (!response || !response.ok) {
        const text = response ? await response.text() : 'no response';
        const status = response ? response.status : 'no-status';
        this.logger.warn(`OpenAI error: ${status} ${text}`);
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      return data?.choices?.[0]?.message?.content || null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fatia 0 do tool-calling pleno — cliente com function-calling NATIVO.
   * ADITIVO e INERTE: nenhum caminho de produção chama isto ainda (o Fix 3 e o
   * router seguem no `callChatCompletions`/`response_format`). Passa `tools` +
   * `tool_choice` no body (montados pelo chamador) e extrai `tool_calls` da
   * resposta (não só `.content`). Devolve um resultado discriminado: ou a(s)
   * ferramenta(s) pedida(s) com args estruturados, ou a narração final.
   *
   * Método SEPARADO de propósito (duplica o fetch/retry) pra garantir que o
   * caminho antigo fica byte-a-byte intacto nesta fatia.
   */
  private async callWithTools(input: {
    apiKey?: string;
    baseUrl: string;
    timeoutMs: number;
    body: Record<string, unknown>;
  }): Promise<ToolCallingResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (input.apiKey) {
        headers.Authorization = `Bearer ${input.apiKey}`;
      }

      let response: Response | null = null;
      const body = JSON.stringify(input.body);

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        response = await fetch(`${input.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
        if (response.ok) {
          break;
        }
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      if (!response || !response.ok) {
        const text = response ? await response.text() : 'no response';
        const status = response ? response.status : 'no-status';
        this.logger.warn(`OpenAI (tools) error: ${status} ${text}`);
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
      };

      const message = data?.choices?.[0]?.message;
      const rawToolCalls = message?.tool_calls;

      if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
        return {
          kind: 'tool_calls',
          toolCalls: rawToolCalls.map((tc) => ({
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            // `arguments` vem como STRING JSON (spec OpenAI/OpenRouter). Parse
            // defensivo: malformado -> {} (o handler da tool trata params vazio,
            // ex.: resolveProductFromParams admite quando falta o product).
            args: this.parseToolArgs(tc.function?.arguments),
          })),
        };
      }

      return { kind: 'content', content: message?.content ?? '' };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseToolArgs(raw: string | undefined): Record<string, unknown> {
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  /**
   * Fatia 1 — um passo do loop de tool-calling: monta o body (config interna +
   * `tools`) e chama o cliente nativo. Público (o loop no `whatsapp.service`
   * chama). Retorna null se não há chave → o chamador DEGRADA pro determinístico
   * do Fix 3 (sem chave = bot idêntico ao de hoje no caminho check_price).
   */
  async runToolStep(
    messages: Array<Record<string, unknown>>,
    tools: Array<Record<string, unknown>>,
    toolChoice: unknown = 'auto',
    model?: string,
    temperature?: number,
  ): Promise<ToolCallingResult | null> {
    const { apiKey, baseUrl, timeoutMs, allowNoKey, model: defaultModel } =
      this.getClientConfig();
    if (!apiKey && !allowNoKey) {
      return null;
    }
    return this.callWithTools({
      apiKey,
      baseUrl,
      timeoutMs,
      body: {
        model: model || defaultModel,
        temperature: temperature ?? 0.3,
        max_tokens: 400,
        tools,
        tool_choice: toolChoice,
        messages,
      },
    });
  }

  private sanitizeConversationalReply(reply: unknown): string {
    return String(reply || '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 600);
  }

  private sanitizeSalesPreferenceProfile(
    value: unknown,
  ): ConversationSalesPreferenceProfile | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const profile = value as Record<string, unknown>;
    const occasion = this.pickAllowedString(profile.occasion, [
      'gift',
      'visit',
      'coffee',
      'dessert',
      'sharing',
      'self_treat',
      'chocolate_focus',
    ]);
    const style = this.pickAllowedString(profile.style, ['delicate', 'safe', 'premium', 'simple']);
    const taste = this.pickAllowedString(profile.taste, [
      'less_sweet',
      'creamy',
      'chocolate_focus',
    ]);
    const recipientHint = String(profile.recipientHint || '').trim() || null;

    if (!occasion && !style && !taste && !recipientHint) {
      return null;
    }

    return {
      occasion,
      style,
      taste,
      recipientHint,
    };
  }

  private pickAllowedString<T extends string>(value: unknown, allowed: T[]): T | null {
    const normalized = String(value || '').trim();
    return (allowed.includes(normalized as T) ? (normalized as T) : null);
  }
}
