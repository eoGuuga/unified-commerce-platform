import { Injectable } from '@nestjs/common';
import { MessageIntelligenceService } from './message-intelligence.service';

export type SalesConversationIntent =
  | 'recommendation'
  | 'comparison'
  | 'budget'
  | 'objection'
  | 'other';

export type SalesPricePreference = 'budget' | 'value' | 'premium' | null;
export type SalesDecisionStage = 'discovering' | 'refining' | 'closing';
export type SalesConversationDriver =
  | 'urgency'
  | 'reassurance'
  | 'simplicity'
  | 'recipient_context'
  | 'value_pressure'
  | 'exploration'
  | 'closing_ready';

export interface SalesConversationAnalysis {
  normalizedText: string;
  intent: SalesConversationIntent;
  secondaryIntents: SalesConversationIntent[];
  confidence: number;
  commercialQuery: string | null;
  budgetCeiling: number | null;
  pricePreference: SalesPricePreference;
  objectionType: 'price' | 'uncertainty' | null;
  decisionStage: SalesDecisionStage;
  conversationDrivers: SalesConversationDriver[];
  recipientHint: string | null;
  useCaseTags: string[];
  signals: {
    comparison: boolean;
    recommendation: boolean;
    budget: boolean;
    objection: boolean;
    indecision: boolean;
    urgency: boolean;
    reassurance: boolean;
    simplicity: boolean;
    recipientContext: boolean;
    closing: boolean;
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
    'mais premium',
    'mais especial',
    'mais completo',
    'mais caprichado',
    'mais sofisticado',
    'mais bonito',
    'mais marcante',
    'pra impressionar',
    'para impressionar',
  ];

  private readonly giftPhrases = ['presente', 'presentear', 'lembranca', 'lembrancinha'];
  private readonly partyPhrases = ['festa', 'aniversario', 'anivers', 'evento', 'comemoracao'];
  private readonly sharingPhrases = [
    'compartilhar',
    'dividir',
    'pra dividir',
    'para dividir',
    'pra galera',
    'pro pessoal',
    'familia',
    'mesa',
    'todo mundo',
    'com o pessoal',
    'pra geral',
    'para geral',
  ];
  private readonly selfTreatPhrases = [
    'mimo',
    'mimo individual',
    'vontade',
    'matar a vontade',
    'docinho pra mim',
    'sobremesa pra mim',
    'so pra mim',
    'só pra mim',
    'pra mim mesmo',
    'para mim mesmo',
  ];
  private readonly chocolateFocusPhrases = [
    'chocolatudo',
    'mais chocolatudo',
    'mais chocolate',
    'mais intenso',
    'mais intenso no chocolate',
    'forte em chocolate',
    'bem chocolatudo',
    'intenso no chocolate',
  ];
  private readonly quickChoicePhrases = ['sem enrolacao', 'um so', 'uma so', 'o melhor pra fechar'];
  private readonly urgencyPhrases = [
    'agora',
    'pra agora',
    'para agora',
    'rapidinho',
    'rapido',
    'quanto antes',
    'sem perder tempo',
    'to com pressa',
    'estou com pressa',
    'pra hoje',
    'para hoje',
  ];
  private readonly reassurancePhrases = [
    'sem erro',
    'nao quero errar',
    'nao posso errar',
    'quero acertar',
    'quero fazer certo',
    'quero ter certeza',
    'tem certeza',
    'me ajuda a acertar',
    'nao quero pagar mico',
    'nao quero passar vergonha',
  ];
  private readonly simplicityPhrases = [
    'sem exagero',
    'mais simples',
    'simples',
    'delicado',
    'discreto',
    'sem inventar',
    'sem muita coisa',
    'sem muita firula',
    'facil de acertar',
    'pratico',
    'pratica',
  ];
  private readonly closingPhrases = [
    'ja quero fechar',
    'quero fechar',
    'vamos fechar',
    'pode fechar',
    'pode ser esse',
    'pode ser essa',
    'vou nessa',
    'vou nesse',
    'esse mesmo',
    'essa mesma',
    'fechou',
    'separa esse',
    'separa essa',
  ];
  private readonly recipientRules: Array<{ label: string; patterns: string[] }> = [
    { label: 'sua mae', patterns: ['pra minha mae', 'para minha mae', 'minha mae'] },
    { label: 'seu pai', patterns: ['pra meu pai', 'para meu pai', 'meu pai'] },
    { label: 'sua namorada', patterns: ['pra minha namorada', 'para minha namorada', 'minha namorada'] },
    { label: 'seu namorado', patterns: ['pra meu namorado', 'para meu namorado', 'meu namorado'] },
    { label: 'sua esposa', patterns: ['pra minha esposa', 'para minha esposa', 'minha esposa'] },
    { label: 'seu marido', patterns: ['pra meu marido', 'para meu marido', 'meu marido'] },
    { label: 'sua amiga', patterns: ['pra minha amiga', 'para minha amiga', 'minha amiga'] },
    { label: 'seu amigo', patterns: ['pra meu amigo', 'para meu amigo', 'meu amigo'] },
    { label: 'sua filha', patterns: ['pra minha filha', 'para minha filha', 'minha filha'] },
    { label: 'seu filho', patterns: ['pra meu filho', 'para meu filho', 'meu filho'] },
    { label: 'sua familia', patterns: ['pra minha familia', 'para minha familia', 'minha familia'] },
    { label: 'sua equipe', patterns: ['pra minha equipe', 'para minha equipe', 'minha equipe'] },
    { label: 'seu cliente', patterns: ['pro cliente', 'para o cliente', 'meu cliente'] },
    { label: 'sua cliente', patterns: ['pra cliente', 'para cliente', 'minha cliente'] },
    { label: 'outra pessoa', patterns: ['pra alguem', 'para alguem', 'outra pessoa'] },
  ];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  analyze(message: string): SalesConversationAnalysis {
    const normalizedText = this.messageIntelligenceService.normalizeText(message);
    const budgetCeiling = this.extractBudgetCeiling(normalizedText);
    const recipientHint = this.extractRecipientHint(normalizedText);
    const urgency = this.hasAny(normalizedText, this.urgencyPhrases);
    const reassurance = this.hasAny(normalizedText, this.reassurancePhrases);
    const simplicity = this.hasAny(normalizedText, this.simplicityPhrases);
    const closing = this.hasAny(normalizedText, this.closingPhrases);
    const useCaseTags = this.collectUseCaseTags(normalizedText, recipientHint);
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
      this.hasAny(normalizedText, this.quickChoicePhrases) ||
      recipientHint !== null ||
      reassurance ||
      simplicity;
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
        (recipientHint ? 0.06 : 0) +
        (reassurance ? 0.05 : 0) +
        (simplicity ? 0.04 : 0) +
        (premium || bestValue ? 0.04 : 0),
    );

    let intent: SalesConversationIntent = 'other';
    let confidence = 0.3;
    let primaryIntentScore = 0.3;

    if (
      comparisonScore >= Math.max(budgetScore, objectionScore, recommendationScore) &&
      comparisonScore >= 0.72
    ) {
      intent = 'comparison';
      confidence = comparisonScore;
      primaryIntentScore = comparisonScore;
    } else if (objection && budgetCeiling === null && objectionScore >= 0.72) {
      intent = 'objection';
      confidence = objectionScore;
      primaryIntentScore = objectionScore;
    } else if (
      budgetScore >= Math.max(objectionScore, recommendationScore) &&
      budgetScore >= 0.72
    ) {
      intent = 'budget';
      confidence = budgetScore;
      primaryIntentScore = budgetScore;
    } else if (objectionScore >= recommendationScore && objectionScore >= 0.72) {
      intent = 'objection';
      confidence = objectionScore;
      primaryIntentScore = objectionScore;
    } else if (recommendationScore >= 0.72) {
      intent = 'recommendation';
      confidence = recommendationScore;
      primaryIntentScore = recommendationScore;
    }

    const secondaryIntents = this.collectSecondaryIntents(intent, primaryIntentScore, {
      comparison: comparisonScore,
      budget: budgetScore,
      objection: objectionScore,
      recommendation: recommendationScore,
    });
    const decisionStage = this.inferDecisionStage(
      intent,
      normalizedText,
      closing,
      comparison,
      budget,
      objection,
      indecision,
      reassurance,
      simplicity,
      recipientHint,
      useCaseTags,
    );
    const conversationDrivers = this.collectConversationDrivers(
      decisionStage,
      recipientHint,
      urgency,
      reassurance,
      simplicity,
      budget || cheaper || objection,
      recommendation || indecision || comparison,
    );

    return {
      normalizedText,
      intent,
      secondaryIntents,
      confidence,
      commercialQuery: this.extractCommercialQuery(normalizedText),
      budgetCeiling,
      pricePreference: cheaper ? 'budget' : bestValue ? 'value' : premium ? 'premium' : null,
      objectionType: objection
        ? /\b(caro|conta|barat|econom|compensa|vale)\b/.test(normalizedText)
          ? 'price'
          : 'uncertainty'
        : null,
      decisionStage,
      conversationDrivers,
      recipientHint,
      useCaseTags,
      signals: {
        comparison,
        recommendation,
        budget,
        objection,
        indecision,
        urgency,
        reassurance,
        simplicity,
        recipientContext: recipientHint !== null,
        closing,
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

  private collectUseCaseTags(normalizedText: string, recipientHint: string | null): string[] {
    const tags = new Set<string>();

    if (this.hasAny(normalizedText, this.giftPhrases)) {
      tags.add('gift');
    }

    if (recipientHint && !this.hasSelfTreatSignal(normalizedText)) {
      tags.add('gift');
    }

    if (this.hasAny(normalizedText, this.partyPhrases)) {
      tags.add('party');
    }

    if (this.hasAny(normalizedText, this.sharingPhrases)) {
      tags.add('sharing');
    }

    if (this.hasSelfTreatSignal(normalizedText)) {
      tags.add('self_treat');
    }

    if (this.hasAny(normalizedText, this.chocolateFocusPhrases)) {
      tags.add('chocolate_focus');
    }

    if (this.hasAny(normalizedText, this.premiumPhrases)) {
      tags.add('premium');
    }

    return Array.from(tags);
  }

  private extractRecipientHint(normalizedText: string): string | null {
    for (const rule of this.recipientRules) {
      if (this.hasAny(normalizedText, rule.patterns)) {
        return rule.label;
      }
    }

    return null;
  }

  private collectSecondaryIntents(
    primaryIntent: SalesConversationIntent,
    primaryScore: number,
    scores: Record<Exclude<SalesConversationIntent, 'other'>, number>,
  ): SalesConversationIntent[] {
    if (primaryIntent === 'other') {
      return [];
    }

    return Object.entries(scores)
      .filter(([intent, score]) => {
        if (intent === primaryIntent) {
          return false;
        }

        return score >= 0.72 || primaryScore - score <= 0.12;
      })
      .sort((left, right) => right[1] - left[1])
      .map(([intent]) => intent as SalesConversationIntent)
      .slice(0, 2);
  }

  private inferDecisionStage(
    intent: SalesConversationIntent,
    normalizedText: string,
    closing: boolean,
    comparison: boolean,
    budget: boolean,
    objection: boolean,
    indecision: boolean,
    reassurance: boolean,
    simplicity: boolean,
    recipientHint: string | null,
    useCaseTags: string[],
  ): SalesDecisionStage {
    if (closing && !comparison && !indecision) {
      return 'closing';
    }

    if (
      comparison ||
      budget ||
      objection ||
      indecision ||
      reassurance ||
      simplicity ||
      recipientHint !== null ||
      useCaseTags.length >= 2 ||
      /\b(entre|compar|ajuda a decidir|me ajuda a escolher)\b/.test(normalizedText)
    ) {
      return 'refining';
    }

    return intent === 'recommendation' ? 'discovering' : 'refining';
  }

  private collectConversationDrivers(
    decisionStage: SalesDecisionStage,
    recipientHint: string | null,
    urgency: boolean,
    reassurance: boolean,
    simplicity: boolean,
    valuePressure: boolean,
    exploration: boolean,
  ): SalesConversationDriver[] {
    const drivers = new Set<SalesConversationDriver>();

    if (urgency) {
      drivers.add('urgency');
    }

    if (reassurance) {
      drivers.add('reassurance');
    }

    if (simplicity) {
      drivers.add('simplicity');
    }

    if (recipientHint) {
      drivers.add('recipient_context');
    }

    if (valuePressure) {
      drivers.add('value_pressure');
    }

    if (exploration) {
      drivers.add('exploration');
    }

    if (decisionStage === 'closing') {
      drivers.add('closing_ready');
    }

    return Array.from(drivers);
  }

  private hasAny(normalizedText: string, phrases: string[]): boolean {
    return phrases.some((phrase) =>
      normalizedText.includes(this.messageIntelligenceService.normalizeText(phrase)),
    );
  }

  private hasSelfTreatSignal(normalizedText: string): boolean {
    if (this.hasAny(normalizedText, this.selfTreatPhrases)) {
      return true;
    }

    const containsForMe =
      normalizedText.includes('pra mim') || normalizedText.includes('para mim');
    if (!containsForMe) {
      return false;
    }

    const consultativeMarkers = /\b(algo|mimo|docinho|sobremesa|vontade|mais)\b/.test(
      normalizedText,
    );
    const directOrderMarkers =
      /\b(me ve|separa|arruma|manda|traz)\b/.test(normalizedText) ||
      /\b(quero|preciso)\s+\d+\b/.test(normalizedText);

    return consultativeMarkers && !directOrderMarkers;
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(1, Number(value.toFixed(2))));
  }
}
