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
    const normalized = this.normalizeText(message);
    const quantity = this.extractQuantity(normalized);
    const product = this.extractProductCandidate(message);

    if (this.isCancelIntent(normalized)) {
      return {
        intent: 'cancelar',
        confidence: 0.86,
      };
    }

    if (this.looksLikeOrderIntent(normalized, quantity, product)) {
      return {
        intent: 'fazer_pedido',
        product: product || undefined,
        quantity: quantity || undefined,
        confidence: product ? 0.82 : 0.68,
      };
    }

    return {
      intent: 'consultar',
      product: product || undefined,
      quantity: quantity || undefined,
      confidence: product ? 0.74 : 0.55,
    };
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\b(qro|qru|kero|kero|queroo+)\b/g, 'quero')
      .replace(/\b(qria|qria|k(r)?ia|keria)\b/g, 'queria')
      .replace(/\b(presciso|presiso|precizo)\b/g, 'preciso')
      .replace(/\b(naum|naun|num)\b/g, 'nao')
      .replace(/\b(vcs|vc|ceis|ces)\b/g, 'voce')
      .replace(/\b(dz)\b/g, 'duzia')
      .replace(/\b(pixx|piks|pics|pic)\b/g, 'pix')
      .replace(/\b(credto|crdito|creditoo)\b/g, 'credito')
      .replace(/\b(debto|dbito|debitoo)\b/g, 'debito')
      .replace(/\b(cancela|cancelaa|cancelai|cancela ai)\b/g, 'cancelar')
      .replace(/\b(desisti|desiste)\b/g, 'desistir')
      .replace(/\b(kd|qd|cadee)\b/g, 'cade')
      .replace(/\b(ond|ondee|aond|aondee)\b/g, 'onde')
      .replace(/\b(cardapioo|cadapio|cardpio|cardapo)\b/g, 'cardapio')
      .replace(/\b(encomeda|encomnda|encomendaa)\b/g, 'encomenda')
      .replace(/\b(praviagem|pra viage[mn])\b/g, 'pra viagem')
      .replace(/\b(retira|retiraa)\b/g, 'retirada')
      .replace(/([a-z])\1{3,}/g, '$1$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isCancelIntent(normalized: string): boolean {
    return ['cancelar', 'cancelamento', 'desistir', 'anular', 'cancela', 'desfazer pedido'].some((keyword) =>
      normalized.includes(keyword),
    );
  }

  private looksLikeOrderIntent(
    normalized: string,
    quantity: number | null,
    product: string | null,
  ): boolean {
    const negativePhrases = [
      'nao quero',
      'nao quero mais',
      'nao vou querer',
      'nao vou mais querer',
      'quero desistir',
      'deixa pra la',
      'deixa para la',
    ];

    if (negativePhrases.some((phrase) => normalized.includes(phrase))) {
      return false;
    }

    const orderKeywords = [
      'quero',
      'preciso',
      'gostaria',
      'vou querer',
      'manda',
      'manda ai',
      'me ve',
      'me manda',
      'separa',
      'separa pra mim',
      'separar',
      'separar pra mim',
      'bota',
      'coloca',
      'traz',
      'separa',
      'pedido',
      'comprar',
      'pedir',
      'encomenda',
      'encomendar',
      'quero levar',
      'quero pegar',
    ];

    if (orderKeywords.some((keyword) => normalized.includes(keyword))) {
      const withoutKeywords = normalized
        .replace(
          /\b(quero|preciso|gostaria|vou querer|manda|manda ai|me ve|me manda|separa|separa pra mim|separar|separar pra mim|bota|coloca|traz|pedido|comprar|pedir|encomenda|encomendar|quero levar|quero pegar)\b/g,
          ' ',
        )
        .replace(/[?!.,;:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!withoutKeywords && !product && !quantity) {
        return false;
      }

      return true;
    }

    return !!product && !!quantity;
  }

  private extractQuantity(normalized: string): number | null {
    const digitMatch = normalized.match(/\b(\d+)\b/);
    if (digitMatch) {
      const parsed = Number(digitMatch[1]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    const writtenQuantities: Array<{ pattern: RegExp; value: number }> = [
      { pattern: /\bmeia duzia\b/, value: 6 },
      { pattern: /\buma duzia\b/, value: 12 },
      { pattern: /\buma dz\b/, value: 12 },
      { pattern: /\bum\b/, value: 1 },
      { pattern: /\buma\b/, value: 1 },
      { pattern: /\bdois\b/, value: 2 },
      { pattern: /\bduas\b/, value: 2 },
      { pattern: /\btres\b/, value: 3 },
      { pattern: /\bquatro\b/, value: 4 },
      { pattern: /\bcinco\b/, value: 5 },
      { pattern: /\bseis\b/, value: 6 },
      { pattern: /\bsete\b/, value: 7 },
      { pattern: /\boito\b/, value: 8 },
      { pattern: /\bnove\b/, value: 9 },
      { pattern: /\bdez\b/, value: 10 },
    ];

    const match = writtenQuantities.find((item) => item.pattern.test(normalized));
    return match ? match.value : null;
  }

  private extractProductCandidate(message: string): string | null {
    const cleaned = this.normalizeText(message)
      .replace(
        /^((ai|ei|hey|opa|oie?|oh|mano|amigo|amiga|moca|porra|caralho|caraio|cacete|merda|lixo|idiota)\s+)+/g,
        '',
      )
      .replace(
        /^((oi+|ola+|bom dia|boa tarde|boa noite|entao|tipo|assim|queria ver se tem como|queria ver se|eu queria|deixa eu ver|deixa eu|sera que tem como|sera que da pra|ve se tem como|ve se|consegue separar pra mim|consegue separar|consegue|voce consegue|voces conseguem|pode separar pra mim|pode separar)\s+)+/g,
        '',
      )
      .replace(
        /\b(quero|preciso|gostaria|vou querer|me ve|me manda|manda|manda ai|separa|separa pra mim|separar|separar pra mim|bota|coloca|traz|pedido|comprar|pedir|encomenda|encomendar|quero levar|quero pegar|preco|valor|quanto custa|quanto|custa|tem|disponivel|estoque|status|pedido|meu|acompanhar|ajuda|menu|cardapio|catalogo)\b/g,
        ' ',
      )
      .replace(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|meia duzia|uma duzia)\b/g, ' ')
      .replace(/\b(de|do|da|dos|das|com|sem|pra|para|pro|pras|pros|por favor|pix|cartao|credito|debito|dinheiro|boleto|retirada|retirar|entrega|entregar)\b/g, ' ')
      .replace(/[?!.,;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned || cleaned.length < 2) {
      return null;
    }

    const meaninglessCandidates = new Set([
      'algo',
      'alguma coisa',
      'coisa',
      'pedido',
      'produto',
      'produtos',
      'quero',
      'comprar',
      'pedir',
    ]);

    if (meaninglessCandidates.has(cleaned)) {
      return null;
    }

    return cleaned;
  }
}
