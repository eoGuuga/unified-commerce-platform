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
    const baseUrl = (this.config.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').trim();
    const model = this.config.get('OPENAI_MODEL') || 'gpt-4o-mini';
    const timeoutMs = Number(this.config.get('OPENAI_TIMEOUT_MS') || 8000);

    const allowNoKey = String(this.config.get('OPENAI_ALLOW_NO_KEY') || '').toLowerCase() === 'true';
    if (!apiKey && !allowNoKey) {
      this.logger.warn('OpenAI API key not configured, using fallback');
      return this.fallbackProcessing(message);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      let response: Response | null = null;
      const body = JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are a classifier. Return ONLY a JSON object with fields: intent (consultar|fazer_pedido|cancelar|outro), product (string or null), quantity (number or null), confidence (0-1).',
          },
          { role: 'user', content: message },
        ],
      });

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        response = await fetch(`${baseUrl}/chat/completions`, {
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

      clearTimeout(timeout);

      if (!response || !response.ok) {
        const text = response ? await response.text() : 'no response';
        const status = response ? response.status : 'no-status';
        this.logger.warn(`OpenAI error: ${status} ${text}`);
        return this.fallbackProcessing(message);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const content = data?.choices?.[0]?.message?.content;
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
