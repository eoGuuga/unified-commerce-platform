import { Injectable } from '@nestjs/common';
import { ProductWithStock } from '../../products/types/product.types';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesConversationAnalysis } from './sales-intelligence.service';

export type ProductOfferRole =
  | 'primary'
  | 'gift_ready'
  | 'sharing'
  | 'bundle'
  | 'impulse'
  | 'accessory';

export type ProductOfferTier = 'entry' | 'mid' | 'premium';

export interface ProductOfferProfile {
  role: ProductOfferRole;
  tier: ProductOfferTier;
  strengths: string[];
  useCases: string[];
  confidence: number;
}

export interface ProductOfferFit {
  score: number;
  reasons: string[];
}

@Injectable()
export class ProductOfferIntelligenceService {
  private readonly accessoryPatterns = [
    'cartao',
    'recadinho',
    'sacola',
    'sacola kraft',
    'embalagem',
    'laco',
    'fitilho',
    'vela',
    'topper',
    'suporte',
    'tag',
  ];

  private readonly giftReadyPatterns = [
    'presente',
    'presenteavel',
    'caixa',
    'box',
    'kit',
    'lembranca',
    'lembrancinha',
  ];

  private readonly sharingPatterns = [
    'duzia',
    'combo',
    'caixa',
    'box',
    'kit',
    'bandeja',
    'bolo',
    'torta',
    'festa',
    'mesa',
    'compartilhar',
  ];

  private readonly impulsePatterns = [
    'individual',
    'mimo',
    'trufa',
    'brigadeiro',
    'beijinho',
    'cookie',
    'brownie',
    'bala',
    'bombom',
    'fatia',
    'pote',
  ];

  private readonly premiumPatterns = [
    'premium',
    'gourmet',
    'artesanal',
    'especial',
    'sofisticado',
    'presenteavel',
    'box',
  ];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  analyzeProduct(
    product: ProductWithStock,
    catalog: ProductWithStock[],
  ): ProductOfferProfile {
    const document = this.buildProductDocument(product);
    const strengths: string[] = [];
    const useCases: string[] = [];

    const accessory = this.matchesAny(document, this.accessoryPatterns);
    const giftReady = this.matchesAny(document, this.giftReadyPatterns);
    const sharing = this.matchesAny(document, this.sharingPatterns);
    const impulse = this.matchesAny(document, this.impulsePatterns);
    const premium = this.matchesAny(document, this.premiumPatterns);

    let role: ProductOfferRole = 'primary';
    if (accessory) {
      role = 'accessory';
    } else if (giftReady) {
      role = 'gift_ready';
    } else if (sharing) {
      role = 'sharing';
    } else if (impulse) {
      role = 'impulse';
    }

    if (giftReady) {
      useCases.push('presente');
      strengths.push('boa leitura para presentear');
    }

    if (sharing) {
      useCases.push('compartilhar');
      strengths.push('segura melhor pedido para dividir');
    }

    if (impulse) {
      useCases.push('mimo individual');
      strengths.push('tem boa saida como mimo individual');
    }

    if (premium) {
      useCases.push('premium');
      strengths.push('eleva mais a percepcao de valor');
    }

    if (!strengths.length) {
      strengths.push('funciona bem como produto principal');
    }

    const tier = this.inferTier(product, catalog, premium);
    if (tier === 'premium' && !strengths.includes('eleva mais a percepcao de valor')) {
      strengths.push('eleva mais a percepcao de valor');
    }

    return {
      role,
      tier,
      strengths: strengths.slice(0, 3),
      useCases: useCases.slice(0, 3),
      confidence: accessory || giftReady || sharing || impulse ? 0.85 : 0.68,
    };
  }

  scoreProduct(
    product: ProductWithStock,
    catalog: ProductWithStock[],
    analysis: SalesConversationAnalysis,
    referenceProduct?: ProductWithStock | null,
  ): ProductOfferFit {
    const profile = this.analyzeProduct(product, catalog);
    const reasons: string[] = [];
    const addReason = (reason: string) => {
      if (reason && !reasons.includes(reason)) {
        reasons.push(reason);
      }
    };

    let score = 0;

    if (profile.role === 'gift_ready' && analysis.useCaseTags.includes('gift')) {
      score += 14;
      addReason('entra mais pronto como presente');
    }

    if (profile.role === 'sharing' && analysis.useCaseTags.includes('sharing')) {
      score += 13;
      addReason('fecha melhor para dividir');
    }

    if (profile.role === 'impulse' && analysis.useCaseTags.includes('self_treat')) {
      score += 12;
      addReason('combina mais com um mimo rapido');
    }

    if (profile.tier === 'premium' && analysis.useCaseTags.includes('premium')) {
      score += 10;
      addReason('sustenta melhor uma escolha premium');
    }

    if (analysis.pricePreference === 'budget' && profile.tier === 'entry') {
      score += 9;
      addReason('protege melhor um ticket mais enxuto');
    }

    if (analysis.pricePreference === 'premium' && profile.tier === 'premium') {
      score += 8;
      addReason('tem leitura mais forte para uma escolha premium');
    }

    if (analysis.conversationDrivers.includes('simplicity') && profile.role === 'impulse') {
      score += 6;
      addReason('resolve de um jeito mais simples');
    }

    if (
      analysis.recipientHint &&
      analysis.useCaseTags.includes('gift') &&
      profile.role === 'gift_ready'
    ) {
      score += 7;
      addReason(`tem mais cara de acerto para presentear ${analysis.recipientHint}`);
    }

    if (referenceProduct) {
      const referenceProfile = this.analyzeProduct(referenceProduct, catalog);
      const productPrice = Number(product.price || 0);
      const referencePrice = Number(referenceProduct.price || 0);

      if (
        referenceProduct.categoria?.name &&
        product.categoria?.name &&
        referenceProduct.categoria.name === product.categoria.name &&
        profile.role === referenceProfile.role
      ) {
        score += 6;
        addReason('fica na mesma linha da opcao que voce trouxe');
      }

      if (
        (analysis.intent === 'budget' || analysis.intent === 'objection') &&
        productPrice < referencePrice
      ) {
        score += 9;
        addReason(`entra abaixo do valor de ${referenceProduct.name}`);
      }

      if (
        analysis.intent === 'comparison' &&
        profile.tier === 'premium' &&
        referenceProfile.tier !== 'premium'
      ) {
        score += 4;
        addReason('representa uma subida mais forte de percepcao');
      }
    }

    profile.strengths.slice(0, 2).forEach(addReason);

    return {
      score,
      reasons: reasons.slice(0, 3),
    };
  }

  private inferTier(
    product: ProductWithStock,
    catalog: ProductWithStock[],
    premiumHint: boolean,
  ): ProductOfferTier {
    const prices = catalog
      .map((item) => Number(item.price || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);

    const price = Number(product.price || 0);
    if (!prices.length || !Number.isFinite(price) || price <= 0) {
      return premiumHint ? 'premium' : 'mid';
    }

    const lowIndex = Math.max(0, Math.floor((prices.length - 1) * 0.33));
    const highIndex = Math.max(0, Math.floor((prices.length - 1) * 0.66));
    const lowThreshold = prices[lowIndex];
    const highThreshold = prices[highIndex];

    if (premiumHint || price >= highThreshold) {
      return 'premium';
    }

    if (price <= lowThreshold) {
      return 'entry';
    }

    return 'mid';
  }

  private buildProductDocument(product: ProductWithStock): string {
    return this.messageIntelligenceService.normalizeText(
      [
        product.name,
        product.description || '',
        product.categoria?.name || '',
        ...(this.collectMetadataStrings(product.metadata) || []),
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  private collectMetadataStrings(metadata?: Record<string, unknown>): string[] {
    if (!metadata) {
      return [];
    }

    return Object.values(metadata)
      .flatMap((value) => {
        if (typeof value === 'string') {
          return [value];
        }

        if (Array.isArray(value)) {
          return value.filter((item): item is string => typeof item === 'string');
        }

        return [];
      })
      .filter(Boolean);
  }

  private matchesAny(document: string, patterns: string[]): boolean {
    return patterns.some((pattern) =>
      document.includes(this.messageIntelligenceService.normalizeText(pattern)),
    );
  }
}
