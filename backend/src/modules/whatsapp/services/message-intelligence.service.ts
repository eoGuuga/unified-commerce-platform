import { Injectable } from '@nestjs/common';
import type { ConversationIntelligenceIntent } from '../types/whatsapp.types';

export type MessageSignalName =
  | 'order'
  | 'cancel'
  | 'status'
  | 'reopen'
  | 'payment'
  | 'help'
  | 'greeting'
  | 'courtesy';

export interface MessageAnalysis {
  normalizedText: string;
  quantity: number | null;
  productCandidate: string | null;
  keywords: string[];
  scores: Record<MessageSignalName, number>;
  matches: Record<MessageSignalName, string[]>;
  flags: {
    explicitCancel: boolean;
    contextualCancel: boolean;
    negativeOrder: boolean;
    uncertainChoice: boolean;
    hasOrderCode: boolean;
    multiItem: boolean;
    lowSignal: boolean;
    needsClarification: boolean;
  };
  primaryIntent: 'consultar' | 'fazer_pedido' | 'cancelar' | 'outro';
  confidence: number;
}

export interface MessageContextSnapshot {
  lastIntent?: ConversationIntelligenceIntent | null;
  lastProductName?: string | null;
  lastProductNames?: string[] | null;
  lastQuantity?: number | null;
  lastQuery?: string | null;
}

export interface ContextualMessageAnalysis extends MessageAnalysis {
  references: {
    repeatReference: boolean;
    pointingReference: boolean;
    additiveReference: boolean;
    selectedSuggestionIndex: number | null;
    contextualFollowUp: boolean;
  };
  contextualProductCandidate: string | null;
  contextualQuantity: number | null;
  contextualIntent: MessageAnalysis['primaryIntent'];
}

type WeightedPhraseGroup = {
  phrases: string[];
  weight: number;
};

@Injectable()
export class MessageIntelligenceService {
  private repairPotentialMojibake(value: string): string {
    const raw = String(value || '');
    if (!raw || !/[ÃÂâ�]/.test(raw)) {
      return raw;
    }

    try {
      const repaired = Buffer.from(raw, 'latin1').toString('utf8');
      const originalNoise = (raw.match(/[ÃÂâ�]/g) || []).length;
      const repairedNoise = (repaired.match(/[ÃÂâ�]/g) || []).length;
      return repairedNoise < originalNoise ? repaired : raw;
    } catch {
      return raw;
    }
  }

  private readonly lowSignalStopWords = new Set([
    'de',
    'do',
    'da',
    'dos',
    'das',
    'com',
    'sem',
    'para',
    'pra',
    'pro',
    'por',
    'favor',
    'o',
    'a',
    'os',
    'as',
    'um',
    'uma',
    'uns',
    'umas',
    'me',
    'te',
    'voce',
    'voces',
    'eu',
    'isso',
    'isto',
    'essa',
    'esse',
    'ai',
    'ae',
    'aqui',
    'agora',
    'entao',
    'tipo',
    'assim',
    'ta',
    'to',
    'sei',
    'la',
    'mais',
    'quero',
    'queria',
    'preciso',
    'gostaria',
    'pedido',
    'comprar',
    'pedir',
  ]);

  private readonly repeatReferencePhrases = [
    'o mesmo',
    'a mesma',
    'igual ao anterior',
    'igual ao de antes',
    'igualzinho',
    'do mesmo',
    'da mesma',
  ];

  private readonly pointingReferencePhrases = [
    'esse',
    'esse ai',
    'esse aqui',
    'esse mesmo',
    'esse item',
    'esse produto',
    'esse da lista',
    'esse do catalogo',
    'esse dai',
    'esse aqui mesmo',
    'essa',
    'essa ai',
    'essa aqui',
    'essa mesma',
    'essa opcao',
    'essa da lista',
    'desse',
    'desse ai',
    'desse aqui',
    'desse item',
    'desse produto',
    'deste',
    'dessa',
    'o de cima',
  ];

  private readonly additiveReferencePhrases = [
    'quero mais',
    'manda mais',
    'adiciona',
    'acrescenta',
    'coloca mais',
    'bota mais',
  ];

  private readonly normalizationRules: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /[\u0000-\u001F\u007F]/g, replacement: ' ' },
    { pattern: /\b(qro|qru|kero|queroo+)\b/g, replacement: 'quero' },
    { pattern: /\b(qria|k(r)?ia|keria)\b/g, replacement: 'queria' },
    { pattern: /\b(to|tava|estou)\s+querendo\b/g, replacement: 'quero' },
    { pattern: /\b(presciso|presiso|precizo)\b/g, replacement: 'preciso' },
    { pattern: /\b(n|nao|num)\s+vo(u)?\b/g, replacement: 'nao vou' },
    { pattern: /\b(naum|naun|num)\b/g, replacement: 'nao' },
    { pattern: /\b(vcs|vc|ceis|ces)\b/g, replacement: 'voce' },
    { pattern: /\b(nois|noix)\b/g, replacement: 'nos' },
    { pattern: /\b(mim\s+ve|mi\s+ve|me\s+veja|mim\s+veja)\b/g, replacement: 'me ve' },
    { pattern: /\b(mim\s+manda|mi\s+manda|manda\s+pra\s+nois|manda\s+pra\s+nos)\b/g, replacement: 'me manda' },
    { pattern: /\b(manda\s+a[ie]|manda\s+aii+)\b/g, replacement: 'me manda' },
    { pattern: /\b(me\s+arruma|arruma\s+pra\s+mim|arruma\s+ai)\b/g, replacement: 'separa' },
    { pattern: /\b(dz)\b/g, replacement: 'duzia' },
    { pattern: /\b(pixx|piks|pics|pic)\b/g, replacement: 'pix' },
    { pattern: /\b(credto|crdito|creditoo)\b/g, replacement: 'credito' },
    { pattern: /\b(debto|dbito|debitoo)\b/g, replacement: 'debito' },
    { pattern: /\b(cancelaa|cancelai|cancela ai)\b/g, replacement: 'cancelar' },
    { pattern: /\b(desisti|desiste)\b/g, replacement: 'desistir' },
    { pattern: /\b(kd|qd|cadee)\b/g, replacement: 'cade' },
    { pattern: /\b(ond|ondee|aond|aondee)\b/g, replacement: 'onde' },
    { pattern: /\b(cardapioo|cadapio|cardpio|cardapo)\b/g, replacement: 'cardapio' },
    { pattern: /\b(encomeda|encomnda|encomendaa)\b/g, replacement: 'encomenda' },
    { pattern: /\b(praviagem|pra viage[mn])\b/g, replacement: 'pra viagem' },
    { pattern: /\b(retira|retiraa)\b/g, replacement: 'retirada' },
    { pattern: /\b(vlw+|valeeu+)\b/g, replacement: 'valeu' },
    { pattern: /\b(blz+|belezinha)\b/g, replacement: 'beleza' },
    { pattern: /\b(fecho+|fexo+)\b/g, replacement: 'fechou' },
    { pattern: /([a-z])\1{3,}/g, replacement: '$1$1' },
    { pattern: /[?!.,;:]/g, replacement: ' ' },
  ];

  private readonly orderStrongGroups: WeightedPhraseGroup[] = [
    {
      phrases: [
        'quero',
        'queria',
        'preciso',
        'gostaria',
        'vou querer',
        'me ve',
        'me manda',
        'separa',
        'comprar',
        'pedir',
        'encomenda',
        'encomendar',
        'quero fazer pedido',
        'quero pedir',
        'quero comprar',
      ],
      weight: 0.52,
    },
    {
      phrases: [
        'manda',
        'bota',
        'coloca',
        'traz',
        'pode ser',
        'faz pra mim',
        'me envia',
        'envia',
      ],
      weight: 0.22,
    },
  ];

  private readonly cancelStrongPhrases = [
    'cancelar',
    'cancelamento',
    'cancelar pedido',
    'cancelar meu pedido',
    'cancela meu pedido',
    'anular',
    'anula',
    'desfazer pedido',
  ];

  private readonly cancelContextualPhrases = [
    'nao quero mais',
    'nao vou querer',
    'nao vou mais querer',
    'nao quero seguir',
    'quero desistir',
    'deixa pra la',
    'deixa para la',
    'deixa pra depois',
    'parar pedido',
    'parar compra',
    'interromper pedido',
    'interromper compra',
    'abandonar pedido',
  ];

  private readonly reopenPhrases = [
    'reabrir',
    'reabre',
    'retomar',
    'retoma',
    'reativar',
    'voltar pedido',
    'continuar pedido',
    'continuar compra',
    'continuar meu pedido',
    'quero continuar',
    'quero retomar',
    'pode continuar',
    'pode retomar',
    'voltar de onde parei',
    'de onde parei',
    'onde paramos',
  ];

  private readonly statusPhrases = [
    'meu pedido',
    'status do pedido',
    'status pedido',
    'acompanhar pedido',
    'acompanha pedido',
    'rastrear pedido',
    'rastreia pedido',
    'cade meu pedido',
    'cade o pedido',
    'onde ta meu pedido',
    'onde ta o pedido',
    'aonde ta meu pedido',
    'como ta meu pedido',
    'qual status do pedido',
    'quando chega meu pedido',
    'quando chega minha entrega',
    'onde ta minha encomenda',
    'cade minha encomenda',
    'cade o motoboy',
    'onde ta o motoboy',
    'cade o entregador',
    'onde ta o entregador',
    'ja saiu com o motoboy',
    'ja saiu com o entregador',
    'andamento do pedido',
    'atualizacao do pedido',
    'atualizacao da entrega',
    'pedido saiu',
    'ja saiu meu pedido',
    'saiu para entrega',
    'chega que horas',
  ];

  private readonly paymentPhrases = [
    'pix',
    'credito',
    'debito',
    'dinheiro',
    'cartao',
    'pagamento',
    'quero pagar',
    'pagar',
    'comprovante',
    'ja paguei',
    'paguei',
    'enviei o pix',
  ];

  private readonly helpPhrases = ['ajuda', 'cardapio', 'catalogo', 'menu'];
  private readonly greetingPhrases = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
  private readonly courtesyPhrases = ['obrigado', 'obrigada', 'valeu', 'fechou', 'beleza'];
  private readonly uncertaintyPhrases = ['nao sei', 'to em duvida', 'estou em duvida', 'talvez'];

  normalizeText(value: string): string {
    let normalized = this.repairPotentialMojibake(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    for (const rule of this.normalizationRules) {
      normalized = normalized.replace(rule.pattern, rule.replacement);
    }

    return normalized.replace(/\s+/g, ' ').trim();
  }

  hasAnyPhrase(normalizedValue: string, phrases: string[]): boolean {
    const normalized = this.normalizeText(normalizedValue);
    if (!normalized) {
      return false;
    }

    return phrases.some((phrase) => normalized.includes(this.normalizeText(phrase)));
  }

  analyze(message: string): MessageAnalysis {
    const normalizedText = this.normalizeText(message);
    const quantity = this.extractQuantity(normalizedText);
    const productCandidate = this.extractProductCandidate(message);
    const keywords = this.extractMeaningfulTokens(normalizedText);
    const hasOrderCode = /\bped[\s-]?\d{8}[\s-]?[a-z0-9]{3,}\b/i.test(normalizedText);
    const multiItem = /\b(e|mais)\b/.test(normalizedText) && /\b\d+\b/.test(normalizedText);

    const orderMatches = this.collectWeightedMatches(normalizedText, this.orderStrongGroups);
    const cancelStrongMatches = this.collectMatches(normalizedText, this.cancelStrongPhrases);
    const cancelContextualMatches = this.collectMatches(normalizedText, this.cancelContextualPhrases);
    const reopenMatches = this.collectMatches(normalizedText, this.reopenPhrases);
    const statusMatches = this.collectMatches(normalizedText, this.statusPhrases);
    const paymentMatches = this.collectMatches(normalizedText, this.paymentPhrases);
    const helpMatches = this.collectMatches(normalizedText, this.helpPhrases);
    const greetingMatches = this.collectMatches(normalizedText, this.greetingPhrases);
    const courtesyMatches = this.collectMatches(normalizedText, this.courtesyPhrases);
    const uncertaintyMatches = this.collectMatches(normalizedText, this.uncertaintyPhrases);

    const negativeOrder = cancelContextualMatches.length > 0;

    const orderScore = this.clampScore(
      orderMatches.score +
        (quantity ? 0.2 : 0) +
        (productCandidate ? 0.24 : 0) +
        (multiItem ? 0.12 : 0) -
        (negativeOrder ? 0.5 : 0),
    );
    const cancelScore = this.clampScore(
      (cancelStrongMatches.length > 0 ? 0.9 : 0) + (cancelContextualMatches.length > 0 ? 0.76 : 0),
    );
    const statusScore = this.clampScore(
      (statusMatches.length > 0 ? 0.82 : 0) + (hasOrderCode ? 0.16 : 0),
    );
    const reopenScore = this.clampScore(reopenMatches.length > 0 ? 0.85 : 0);
    const paymentScore = this.clampScore(paymentMatches.length > 0 ? 0.8 : 0);
    const helpScore = this.clampScore(helpMatches.length > 0 ? 0.8 : 0);
    const greetingScore = this.clampScore(greetingMatches.length > 0 ? 0.68 : 0);
    const courtesyScore = this.clampScore(courtesyMatches.length > 0 ? 0.66 : 0);
    const rawProductGuessOnly =
      !!productCandidate &&
      quantity === null &&
      productCandidate === normalizedText &&
      orderScore < 0.45 &&
      cancelScore < 0.45 &&
      statusScore < 0.45 &&
      reopenScore < 0.45 &&
      paymentScore < 0.45;

    let primaryIntent: MessageAnalysis['primaryIntent'] = 'outro';
    let confidence = 0.35;

    if (cancelScore >= Math.max(orderScore, statusScore, reopenScore, paymentScore) && cancelScore >= 0.72) {
      primaryIntent = 'cancelar';
      confidence = cancelScore;
    } else if (orderScore >= Math.max(statusScore, reopenScore, paymentScore) && orderScore >= 0.72) {
      primaryIntent = 'fazer_pedido';
      confidence = orderScore;
    } else if (
      statusScore >= 0.72 ||
      reopenScore >= 0.72 ||
      paymentScore >= 0.72 ||
      helpScore >= 0.6 ||
      greetingScore >= 0.6 ||
      courtesyScore >= 0.6 ||
      (Boolean(productCandidate) && !rawProductGuessOnly)
    ) {
      primaryIntent = 'consultar';
      confidence = Math.max(
        statusScore,
        reopenScore,
        paymentScore,
        helpScore,
        greetingScore,
        courtesyScore,
        productCandidate ? 0.58 : 0.45,
      );
    }

    const lowSignal =
      !normalizedText ||
      (!quantity &&
        (keywords.length <= 1 || rawProductGuessOnly) &&
        orderScore < 0.45 &&
        cancelScore < 0.45 &&
        statusScore < 0.45 &&
        reopenScore < 0.45 &&
        paymentScore < 0.45 &&
        helpScore < 0.6 &&
        greetingScore < 0.6 &&
        courtesyScore < 0.6);

    const needsClarification =
      primaryIntent === 'outro' &&
      (lowSignal ||
        rawProductGuessOnly ||
        (!!productCandidate && productCandidate.length < 4 && keywords.length <= 1));

    return {
      normalizedText,
      quantity,
      productCandidate,
      keywords,
      scores: {
        order: orderScore,
        cancel: cancelScore,
        status: statusScore,
        reopen: reopenScore,
        payment: paymentScore,
        help: helpScore,
        greeting: greetingScore,
        courtesy: courtesyScore,
      },
      matches: {
        order: orderMatches.matches,
        cancel: [...cancelStrongMatches, ...cancelContextualMatches],
        status: statusMatches,
        reopen: reopenMatches,
        payment: paymentMatches,
        help: helpMatches,
        greeting: greetingMatches,
        courtesy: courtesyMatches,
      },
      flags: {
        explicitCancel: cancelStrongMatches.length > 0,
        contextualCancel: cancelContextualMatches.length > 0,
        negativeOrder,
        uncertainChoice: uncertaintyMatches.length > 0,
        hasOrderCode,
        multiItem,
        lowSignal,
        needsClarification,
      },
      primaryIntent,
      confidence,
    };
  }

  analyzeWithContext(
    message: string,
    context?: MessageContextSnapshot,
  ): ContextualMessageAnalysis {
    const analysis = this.analyze(message);
    const normalizedText = analysis.normalizedText;
    const repeatReference = this.hasAnyPhrase(normalizedText, this.repeatReferencePhrases);
    const pointingReference = this.hasAnyPhrase(normalizedText, this.pointingReferencePhrases);
    const additiveReference =
      this.hasAnyPhrase(normalizedText, this.additiveReferencePhrases) ||
      /^(mais|quero mais)\b/.test(normalizedText);
    const selectedSuggestionIndex = this.findSelectedSuggestionIndex(normalizedText);
    const supportsOrdinalSelection = [
      'suggestion',
      'recommendation',
      'comparison',
      'budget',
      'objection',
      'price',
      'stock',
    ].includes(
      context?.lastIntent || '',
    );
    const hasSelectedSuggestion =
      supportsOrdinalSelection &&
      selectedSuggestionIndex !== null &&
      selectedSuggestionIndex <= (context?.lastProductNames || []).length;
    const contextualFollowUp =
      !!context &&
      (repeatReference ||
        pointingReference ||
        additiveReference ||
        hasSelectedSuggestion);

    const selectedProduct =
      hasSelectedSuggestion
        ? (context?.lastProductNames || [])[selectedSuggestionIndex - 1] || null
        : null;
    const singleContextProduct =
      context?.lastProductName ||
      ((context?.lastProductNames || []).length === 1
        ? (context?.lastProductNames || [])[0]
        : null);

    const contextualProductCandidate =
      !analysis.productCandidate || this.isReferenceOnlyCandidate(analysis.productCandidate)
        ? selectedProduct ||
          (repeatReference || additiveReference || pointingReference ? singleContextProduct : null)
        : analysis.productCandidate;

    let contextualQuantity = analysis.quantity;
    if (hasSelectedSuggestion) {
      contextualQuantity =
        selectedProduct &&
        context?.lastIntent === 'suggestion' &&
        typeof context.lastQuantity === 'number' &&
        context.lastQuantity > 0
          ? context.lastQuantity
          : null;
    } else if (contextualQuantity === null) {
      if (
        selectedProduct &&
        context?.lastIntent === 'suggestion' &&
        typeof context.lastQuantity === 'number' &&
        context.lastQuantity > 0
      ) {
        contextualQuantity = context.lastQuantity;
      } else if (
        repeatReference &&
        typeof context?.lastQuantity === 'number' &&
        context.lastQuantity > 0
      ) {
        contextualQuantity = context.lastQuantity;
      } else if (additiveReference && (repeatReference || pointingReference)) {
        contextualQuantity = 1;
      }
    }

    let contextualIntent = analysis.primaryIntent;
    if (contextualProductCandidate && contextualFollowUp) {
      if (
        hasSelectedSuggestion &&
        (context?.lastIntent === 'price' || context?.lastIntent === 'stock') &&
        analysis.scores.order < 0.45
      ) {
        contextualIntent = 'consultar';
      } else if (repeatReference || additiveReference) {
        contextualIntent = 'fazer_pedido';
      } else if (pointingReference || hasSelectedSuggestion) {
        contextualIntent =
          context?.lastIntent === 'price' || context?.lastIntent === 'stock'
            ? 'consultar'
            : 'fazer_pedido';
      }
    }

    return {
      ...analysis,
      references: {
        repeatReference,
        pointingReference,
        additiveReference,
        selectedSuggestionIndex: hasSelectedSuggestion ? selectedSuggestionIndex : null,
        contextualFollowUp,
      },
      contextualProductCandidate,
      contextualQuantity,
      contextualIntent,
    };
  }

  extractQuantity(normalizedValue: string): number | null {
    const normalized = this.normalizeText(normalizedValue);
    const digitMatch = normalized.match(/\b(\d+)\b/);
    if (digitMatch) {
      const parsed = Number(digitMatch[1]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    const writtenQuantities: Array<{ pattern: RegExp; value: number }> = [
      { pattern: /\bmeia duzia\b/, value: 6 },
      { pattern: /\buma duzia\b/, value: 12 },
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

  extractProductCandidate(message: string): string | null {
    const cleaned = this.normalizeText(message)
      .replace(
        /^((ai|ei|hey|opa|oie?|oh|mano|amigo|amiga|moca|cara|patrao|chefia)\s+)+/g,
        '',
      )
      .replace(
        /^((oi+|ola+|bom dia|boa tarde|boa noite|entao|tipo|assim|eu queria|deixa eu ver|sera que tem como|sera que da pra|ve se|consegue|pode separar)\s+)+/g,
        '',
      )
      .replace(
        /\b(quero|queria|preciso|gostaria|vou querer|me ve|me manda|manda|separa|bota|coloca|traz|pedido|comprar|pedir|encomenda|encomendar|quero levar|quero pegar|preco|valor|quanto custa|quanto|custa|tem|disponivel|estoque|status|meu|acompanhar|ajuda|menu|cardapio|catalogo)\b/g,
        ' ',
      )
      .replace(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|meia duzia|uma duzia)\b/g, ' ')
      .replace(/\b(de|do|da|dos|das|com|sem|pra|para|pro|pras|pros|por favor|pix|cartao|credito|debito|dinheiro|boleto|retirada|retirar|entrega|entregar)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned || cleaned.length < 2) {
      return null;
    }

    if (/^\d+$/.test(cleaned)) {
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

  private collectMatches(normalized: string, phrases: string[]): string[] {
    return phrases.filter((phrase) => normalized.includes(this.normalizeText(phrase)));
  }

  private isReferenceOnlyCandidate(candidate: string): boolean {
    const normalized = this.normalizeText(candidate)
      .replace(/\b\d+\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return new Set([
      'o mesmo',
      'a mesma',
      'esse',
      'esse item',
      'esse produto',
      'esse da lista',
      'esse do catalogo',
      'essa',
      'essa opcao',
      'essa da lista',
      'esse ai',
      'essa ai',
      'esse aqui',
      'essa aqui',
      'desse',
      'desse item',
      'desse produto',
      'deste',
      'dessa',
      'mais',
      'quero mais',
    ]).has(normalized);
  }

  private findSelectedSuggestionIndex(normalized: string): number | null {
    const directNumberMatch = normalized.match(/^(?:opcao|opcao numero|numero)?\s*(\d)\b/);
    if (directNumberMatch) {
      const index = Number(directNumberMatch[1]);
      return index >= 1 && index <= 9 ? index : null;
    }

    const ordinalMap: Array<{ pattern: RegExp; index: number }> = [
      { pattern: /\b(primeiro|primeira)\b/, index: 1 },
      { pattern: /\b(segundo|segunda)\b/, index: 2 },
      { pattern: /\b(terceiro|terceira)\b/, index: 3 },
      { pattern: /\b(quarto|quarta)\b/, index: 4 },
    ];

    const ordinal = ordinalMap.find((entry) => entry.pattern.test(normalized));
    return ordinal ? ordinal.index : null;
  }

  private collectWeightedMatches(
    normalized: string,
    groups: WeightedPhraseGroup[],
  ): { score: number; matches: string[] } {
    let score = 0;
    const matches: string[] = [];

    for (const group of groups) {
      const groupMatches = this.collectMatches(normalized, group.phrases);
      if (groupMatches.length > 0) {
        score += group.weight;
        matches.push(...groupMatches);
      }
    }

    return {
      score: this.clampScore(score),
      matches,
    };
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(1, Number(value.toFixed(2))));
  }

  private extractMeaningfulTokens(normalized: string): string[] {
    if (!normalized) {
      return [];
    }

    return normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 || /^\d+$/.test(token))
      .filter((token) => !this.lowSignalStopWords.has(token));
  }
}
