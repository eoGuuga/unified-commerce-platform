import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageIntelligenceService } from './message-intelligence.service';

export interface MessageIntent {
  intent: 'consultar' | 'fazer_pedido' | 'cancelar' | 'outro';
  product?: string;
  quantity?: number;
  confidence: number;
}

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
  } | null;
}

export interface ConversationalAssistResult {
  safeReply: string;
  confidence: number;
  detectedGoal: string;
  detectedEmotion: 'neutral' | 'confused' | 'frustrated' | 'hesitant' | 'urgent';
  shouldStayInCurrentStage: boolean;
  mentionsProduct?: string;
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
                'You classify Brazilian Portuguese WhatsApp sales messages for a store assistant.',
                'Return ONLY valid JSON.',
                'If the message is off-topic, emotional, too vague, or not safe to infer, use intent="outro".',
                'Never invent products or quantities when uncertain.',
                'Use intent="consultar" for price/stock/catalog questions, "fazer_pedido" for clear purchase intent, "cancelar" only for clear cancellation intent.',
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
        },
        required: [
          'safeReply',
          'confidence',
          'detectedGoal',
          'detectedEmotion',
          'shouldStayInCurrentStage',
          'mentionsProduct',
        ],
      } as const;

      const catalogSummary = (input.catalogSummary || [])
        .map((line) => `- ${line}`)
        .join('\n');
      const memory = input.memory || null;
      const memoryLines = [
        memory?.lastIntent ? `- ultima_intencao: ${memory.lastIntent}` : null,
        memory?.lastProductName ? `- ultimo_produto: ${memory.lastProductName}` : null,
        memory?.lastProductNames?.length
          ? `- ultimos_produtos: ${memory.lastProductNames.join(', ')}`
          : null,
        memory?.lastCustomerGoal ? `- ultimo_objetivo: ${memory.lastCustomerGoal}` : null,
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

  private sanitizeConversationalReply(reply: unknown): string {
    return String(reply || '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 600);
  }
}
