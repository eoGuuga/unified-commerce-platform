import { Injectable } from '@nestjs/common';
import { MessageIntelligenceService } from './message-intelligence.service';

export type SalesConversationIntent =
  | 'recommendation'
  | 'comparison'
  | 'budget'
  | 'objection'
  | 'other';

export type SalesPricePreference = 'budget' | 'value' | 'premium' | null;

export interface SalesConversationAnalysis {
  normalizedText: string;
  intent: SalesConversationIntent;
  confidence: number;
  commercialQuery: string | null;
  budgetCeiling: number | null;
  pricePreference: SalesPricePreference;
  objectionType: 'price' | 'uncertainty' | null;
  useCaseTags: string[];
  signals: {
    comparison: boolean;
    recommendation: boolean;
    budget: boolean;
    objection: boolean;
    indecision: boolean;
  };
}

@Injectable()
export class SalesIntelligenceService {
  private readonly recommendationPhrases = [
    'me indica',
    'me recomenda',
    'recomenda',
    'recomendacao',
    'indica',
    'sugere',
    'sugestao',
    'qual voce indica',
    'qual voce recomenda',
    'algo para',
    'opcao para',
    'opcoes para',
    'o que voce sugere',
    'o que sai mais',
    'mais vendido',
    'mais procurado',
    'o melhor',
  ];

  private readonly comparisonPhrases = [
    'qual melhor',
    'qual e melhor',
    'qual vale mais a pena',
    'vale mais a pena',
    'vale a pena',
    'compensa mais',
    'qual compensa',
    'diferenca entre',
    'qual a diferenca',
    'compara',
    'comparar',
    'vs',
    'versus',
  ];

  private readonly budgetPhrases = [
    'mais barato',
    'mais em conta',
    'barato',
    'baratinho',
    'economico',
    'economica',
    'economizar',
    'custo beneficio',
    'custo-beneficio',
    'vale a pena',
    'compensa',
    'na faixa de',
    'por volta de',
    'em torno de',
    'ate',
    'menos de',
    'abaixo de',
    'no maximo',
    'maximo de',
  ];

  private readonly objectionPhrases = [
    'ta caro',
    'esta caro',
    'muito caro',
    'caro demais',
    'salgado',
    'pesou',
    'mais em conta',
    'mais barato',
  ];

  private readonly indecisionPhrases = [
    'nao sei',
    'to em duvida',
    'estou em duvida',
    'em duvida',
    'qual escolher',
    'me ajuda a escolher',
    'o que voce acha',
  ];

  private readonly premiumPhrases = [
    'premium',
    'mais premium',
    'mais especial',
    'mais completo',
    'mais caprichado',
    'melhor',
    'top',
  ];

  private readonly giftPhrases = ['presente', 'presentear', 'lembranca', 'lembrancinha'];
  private readonly partyPhrases = ['festa', 'aniversario', 'anivers', 'evento', 'comemoracao'];
  private readonly quickChoicePhrases = ['sem enrolacao', 'um so', 'uma so', 'o melhor pra fechar'];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  analyze(message: string): SalesConversationAnalysis {
    const normalizedText = this.messageIntelligenceService.normalizeText(message);
    const budgetCeiling = this.extractBudgetCeiling(normalizedText);
    const useCaseTags = this.collectUseCaseTags(normalizedText);
    const comparison =
      this.hasAny(normalizedText, this.comparisonPhrases) ||
      /\b(vs|versus)\b/.test(normalizedText) ||
      (/\bou\b/.test(normalizedText) &&
        /(qual|melhor|vale|compensa|diferen|entre|escolher)/.test(normalizedText));
    const indecision = this.hasAny(normalizedText, this.indecisionPhrases);
    const recommendation =
      this.hasAny(normalizedText, this.recommendationPhrases) ||
      indecision ||
      useCaseTags.length > 0 ||
      this.hasAny(normalizedText, this.quickChoicePhrases);
    const budget =
      budgetCeiling !== null ||
      this.hasAny(normalizedText, this.budgetPhrases) ||
      /\b(quanto consigo|quanto daria|quanto fica)\b/.test(normalizedText);
    const objection = this.hasAny(normalizedText, this.objectionPhrases);
    const premium = this.hasAny(normalizedText, this.premiumPhrases);
    const cheaper =
      budget ||
      /\b(mais barato|mais em conta|econom|barat|baixo custo|gastar menos)\b/.test(
        normalizedText,
      );
    const bestValue = /\b(custo beneficio|custo-beneficio|vale a pena|compensa)\b/.test(
      normalizedText,
    );

    const comparisonScore = this.clampScore(
      (comparison ? 0.84 : 0) + (indecision ? 0.08 : 0) + (budgetCeiling !== null ? 0.05 : 0),
    );
    const budgetScore = this.clampScore(
      (budget ? 0.8 : 0) + (objection ? 0.08 : 0) + (cheaper ? 0.08 : 0),
    );
    const objectionScore = this.clampScore(
      (objection ? 0.82 : 0) + (budgetCeiling !== null ? 0.06 : 0),
    );
    const recommendationScore = this.clampScore(
      (recommendation ? 0.8 : 0) +
        (indecision ? 0.08 : 0) +
        (useCaseTags.length > 0 ? 0.06 : 0) +
        (premium || bestValue ? 0.04 : 0),
    );

    let intent: SalesConversationIntent = 'other';
    let confidence = 0.3;

    if (
      comparisonScore >= Math.max(budgetScore, objectionScore, recommendationScore) &&
      comparisonScore >= 0.72
    ) {
      intent = 'comparison';
      confidence = comparisonScore;
    } else if (objection && budgetCeiling === null && objectionScore >= 0.72) {
      intent = 'objection';
      confidence = objectionScore;
    } else if (
      budgetScore >= Math.max(objectionScore, recommendationScore) &&
      budgetScore >= 0.72
    ) {
      intent = 'budget';
      confidence = budgetScore;
    } else if (objectionScore >= recommendationScore && objectionScore >= 0.72) {
      intent = 'objection';
      confidence = objectionScore;
    } else if (recommendationScore >= 0.72) {
      intent = 'recommendation';
      confidence = recommendationScore;
    }

    return {
      normalizedText,
      intent,
      confidence,
      commercialQuery: this.extractCommercialQuery(normalizedText),
      budgetCeiling,
      pricePreference: cheaper ? 'budget' : bestValue ? 'value' : premium ? 'premium' : null,
      objectionType: objection
        ? /\b(caro|conta|barat|econom|compensa|vale)\b/.test(normalizedText)
          ? 'price'
          : 'uncertainty'
        : null,
      useCaseTags,
      signals: {
        comparison,
        recommendation,
        budget,
        objection,
        indecision,
      },
    };
  }

  extractCommercialQuery(message: string): string | null {
    const cleaned = this.messageIntelligenceService
      .normalizeText(message)
      .replace(
        /\b(me indica|me recomenda|recomenda|recomendacao|indica|sugere|sugestao|qual voce indica|qual voce recomenda|algo para|opcao para|opcoes para|o que voce sugere|o que sai mais|mais vendido|mais procurado|qual melhor|qual e melhor|qual vale mais a pena|vale mais a pena|vale a pena|compensa mais|qual compensa|diferenca entre|qual a diferenca|compara|comparar|vs|versus|mais barato|mais em conta|barato|baratinho|economico|economica|economizar|custo beneficio|custo-beneficio|na faixa de|por volta de|em torno de|ate|menos de|abaixo de|no maximo|maximo de|ta caro|esta caro|muito caro|caro demais|salgado|pesou|nao sei se vale|nao sei se compensa|to em duvida|estou em duvida|nao sei qual|nao sei o que escolher|premium|mais premium|mais especial|mais completo|mais caprichado|melhor|top|presente|presentear|lembranca|lembrancinha|festa|aniversario|anivers|evento|comemoracao|sem enrolacao|um so|uma so|o melhor pra fechar|tem|algo|item|produto|produtos|para|pra|de|do|da|dos|das|com|sem|um|uma|uns|umas|o|a|os|as|me|por favor|favor)\b/g,
        ' ',
      )
      .replace(/\br\$?\s*\d+(?:[.,]\d{1,2})?\b/g, ' ')
      .replace(/\b\d+(?:[.,]\d{1,2})?\s*(?:reais|real)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned || cleaned.length < 2) {
      return null;
    }

    return cleaned;
  }

  private extractBudgetCeiling(normalizedText: string): number | null {
    const patterns = [
      /\b(?:ate|no maximo|maximo de|menos de|abaixo de|na faixa de|por volta de|em torno de)\s*(?:r\$)?\s*(\d+(?:[.,]\d{1,2})?)\b/,
      /\b(?:ate|no maximo|maximo de|menos de|abaixo de)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)\b/,
    ];

    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (!match) {
        continue;
      }

      const value = Number(match[1].replace(',', '.'));
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private collectUseCaseTags(normalizedText: string): string[] {
    const tags = new Set<string>();

    if (this.hasAny(normalizedText, this.giftPhrases)) {
      tags.add('gift');
    }

    if (this.hasAny(normalizedText, this.partyPhrases)) {
      tags.add('party');
    }

    return Array.from(tags);
  }

  private hasAny(normalizedText: string, phrases: string[]): boolean {
    return phrases.some((phrase) =>
      normalizedText.includes(this.messageIntelligenceService.normalizeText(phrase)),
    );
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(1, Number(value.toFixed(2))));
  }
}
