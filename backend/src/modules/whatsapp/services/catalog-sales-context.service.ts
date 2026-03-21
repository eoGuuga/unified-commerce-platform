import { Injectable } from '@nestjs/common';
import { ProductWithStock } from '../../products/types/product.types';
import { SalesConversationAnalysis } from './sales-intelligence.service';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesPlaybookProfile, SalesPlaybookSegment } from './sales-playbook.service';

type CatalogThemeKey =
  | 'gift'
  | 'sharing'
  | 'self_treat'
  | 'premium'
  | 'chocolate'
  | 'celebration';

type CatalogThemeRule = {
  key: CatalogThemeKey;
  label: string;
  questionLabel: string;
  recommendationReason: string;
  patterns: string[];
};

type CatalogThemeSummary = {
  key: CatalogThemeKey;
  label: string;
  questionLabel: string;
  recommendationReason: string;
  patterns: string[];
  count: number;
};

type ConfectioneryConversationCueKey =
  | 'gift_ready'
  | 'sharing_order'
  | 'chocolate_focus'
  | 'self_treat'
  | 'premium_choice';

type ConfectioneryConversationCue = {
  key: ConfectioneryConversationCueKey;
  focusLine: string;
  qualificationQuestion: string;
  recommendationReason: string;
  preferredThemes: CatalogThemeKey[];
  score: number;
};

export interface CatalogSalesProfile {
  segment: SalesPlaybookSegment;
  storeLabel: string;
  dominantCategory: string | null;
  catalogReading: string;
  focusThemes: CatalogThemeSummary[];
  qualificationQuestion: string;
}

export interface CatalogSalesFit {
  score: number;
  reasons: string[];
}

@Injectable()
export class CatalogSalesContextService {
  private readonly ignoredMetadataKeys = new Set([
    'source',
    'store_slug',
    'source_platform',
    'source_catalog_url',
    'source_store_slug',
    'source_store_url',
    'source_image_url',
    'source_category_name',
    'source_product_id',
    'source_category_id',
    'source_category_slug',
    'source_restaurante_n',
    'imported_from_catalog',
    'imported_at',
    'kind',
    'homologation_stock_is_synthetic',
  ]);

  private readonly themeRules: CatalogThemeRule[] = [
    {
      key: 'gift',
      label: 'presente',
      questionLabel: 'presente',
      recommendationReason: 'boa leitura para presente',
      patterns: [
        'presente',
        'presentear',
        'lembranca',
        'lembrancinha',
        'caixa',
        'box',
        'kit',
      ],
    },
    {
      key: 'sharing',
      label: 'compartilhar',
      questionLabel: 'compartilhar',
      recommendationReason: 'funciona bem para compartilhar',
      patterns: [
        'compartilhar',
        'dividir',
        'duzia',
        'combo',
        'caixa',
        'box',
        'kit',
        'mesa',
        'bandeja',
      ],
    },
    {
      key: 'self_treat',
      label: 'mimo individual',
      questionLabel: 'mimo individual',
      recommendationReason: 'tem boa saida como mimo individual',
      patterns: [
        'individual',
        'unidade',
        'docinho',
        'sobremesa',
        'vontade',
        'brigadeiro',
        'brownie',
        'trufa',
        'cookie',
      ],
    },
    {
      key: 'premium',
      label: 'premium',
      questionLabel: 'algo mais marcante',
      recommendationReason: 'eleva percepcao premium',
      patterns: ['premium', 'gourmet', 'artesanal', 'fino', 'especial', 'sofisticado'],
    },
    {
      key: 'chocolate',
      label: 'chocolate',
      questionLabel: 'algo mais intenso no chocolate',
      recommendationReason: 'tem apelo forte de chocolate',
      patterns: ['chocolate', 'cacau', 'ganache', 'trufa', 'brigadeiro', 'brownie'],
    },
    {
      key: 'celebration',
      label: 'evento',
      questionLabel: 'evento ou mesa',
      recommendationReason: 'resolve melhor uma compra de evento',
      patterns: ['festa', 'aniversario', 'evento', 'comemoracao', 'bolo', 'torta'],
    },
  ];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  buildProfile(
    products: ProductWithStock[],
    playbook: SalesPlaybookProfile,
  ): CatalogSalesProfile {
    const allThemes = this.themeRules
      .map((rule) => ({
        ...rule,
        count: products.reduce(
          (total, product) => total + (this.matchesTheme(product, rule) ? 1 : 0),
          0,
        ),
      }))
      .filter((theme) => theme.count > 0)
      .sort((left, right) => right.count - left.count);

    const focusThemes = allThemes
      .slice(0, 3);

    const dominantCategory = this.getDominantCategory(products);
    const storeLabel = this.buildStoreLabel(playbook, allThemes, dominantCategory);

    return {
      segment: playbook.segment,
      storeLabel,
      dominantCategory,
      focusThemes,
      catalogReading: this.buildCatalogReading(playbook, storeLabel, focusThemes),
      qualificationQuestion: this.buildQualificationQuestion(playbook, focusThemes),
    };
  }

  buildProductSearchDocument(product: ProductWithStock): string {
    const metadataStrings = this.collectMetadataStrings(product.metadata);
    return this.messageIntelligenceService.normalizeText(
      [
        product.name,
        product.description || '',
        product.categoria?.name || '',
        ...metadataStrings,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  scoreProduct(
    product: ProductWithStock,
    analysis: SalesConversationAnalysis,
    profile: CatalogSalesProfile,
  ): CatalogSalesFit {
    const matchedThemes = this.getMatchedThemes(product, profile.focusThemes);
    const confectioneryCues = this.collectConfectioneryConversationCues(profile, analysis);
    const reasons: string[] = [];
    const addReason = (reason: string) => {
      if (reason && !reasons.includes(reason)) {
        reasons.push(reason);
      }
    };

    let score = 0;

    if (
      analysis.normalizedText.includes('chocolate') &&
      this.hasTheme(matchedThemes, 'chocolate')
    ) {
      score += 12;
      addReason('apelo forte de chocolate');
    }

    matchedThemes.slice(0, 2).forEach((theme) => {
      score += 5;
      addReason(theme.recommendationReason);
    });

    if (analysis.useCaseTags.includes('gift') && this.hasTheme(matchedThemes, 'gift')) {
      score += 14;
      addReason('combina bem com contexto de presente');
    }

    if (analysis.useCaseTags.includes('sharing') && this.hasTheme(matchedThemes, 'sharing')) {
      score += 13;
      addReason('fecha melhor para dividir sem perder impacto');
    }

    if (
      analysis.useCaseTags.includes('party') &&
      (this.hasTheme(matchedThemes, 'sharing') || this.hasTheme(matchedThemes, 'celebration'))
    ) {
      score += 14;
      addReason('fecha melhor para compartilhar');
    }

    if (analysis.useCaseTags.includes('self_treat') && this.hasTheme(matchedThemes, 'self_treat')) {
      score += 12;
      addReason('funciona melhor para vontade do dia');
    }

    if (analysis.useCaseTags.includes('chocolate_focus') && this.hasTheme(matchedThemes, 'chocolate')) {
      score += 14;
      addReason('entrega a leitura mais chocolatuda');
    }

    if (analysis.pricePreference === 'premium' && this.hasTheme(matchedThemes, 'premium')) {
      score += 10;
      addReason('segura melhor uma escolha mais premium');
    }

    if (analysis.useCaseTags.includes('premium') && this.hasTheme(matchedThemes, 'premium')) {
      score += 9;
      addReason('sustenta melhor uma percepcao premium');
    }

    confectioneryCues.forEach((cue) => {
      const matchesCue = cue.preferredThemes.some((themeKey) => this.matchesThemeKey(product, themeKey));
      if (!matchesCue) {
        return;
      }

      score += cue.score;
      addReason(cue.recommendationReason);
    });

    if (
      profile.segment === 'confectionery' &&
      (this.hasTheme(matchedThemes, 'chocolate') || this.hasTheme(profile.focusThemes, 'chocolate'))
    ) {
      score += 8;
      addReason('tem boa leitura dentro da loja de chocolate');
    }

    const metadataHint = this.extractMetadataHint(product);
    if (metadataHint) {
      score += 6;
      addReason(metadataHint);
    }

    return { score, reasons: reasons.slice(0, 3) };
  }

  buildCatalogContext(profile: CatalogSalesProfile): string {
    return `Leitura do catalogo atual: ${profile.catalogReading}`;
  }

  buildConversationFocusLine(
    profile: CatalogSalesProfile,
    analysis: SalesConversationAnalysis,
  ): string | null {
    return this.collectConfectioneryConversationCues(profile, analysis)[0]?.focusLine || null;
  }

  buildDynamicQualificationQuestion(
    profile: CatalogSalesProfile,
    analysis: SalesConversationAnalysis,
  ): string {
    return (
      this.collectConfectioneryConversationCues(profile, analysis)[0]?.qualificationQuestion ||
      profile.qualificationQuestion
    );
  }

  buildQualificationQuestion(
    playbook: SalesPlaybookProfile,
    focusThemes: CatalogThemeSummary[],
  ): string {
    const questionLabels = focusThemes.map((theme) => theme.questionLabel);

    if (playbook.segment === 'confectionery') {
      const ordered = this.pickQuestionLabels(questionLabels, [
        'presente',
        'mimo individual',
        'compartilhar',
        'evento ou mesa',
        'algo mais intenso no chocolate',
      ]);

      if (ordered.length >= 3) {
        return `Voce quer algo mais para ${ordered[0]}, ${ordered[1]} ou ${ordered[2]}?`;
      }

      if (ordered.length === 2) {
        return `Voce quer algo mais para ${ordered[0]} ou ${ordered[1]}?`;
      }

      return 'Voce quer algo mais para presente, mimo individual ou compartilhar?';
    }

    if (questionLabels.length >= 2) {
      return `Se eu afinar a recomendacao, isso faz mais sentido para ${questionLabels[0]} ou ${questionLabels[1]}?`;
    }

    return `Se eu afinar a recomendacao, isso faz mais sentido dentro de ${playbook.label} para qual contexto?`;
  }

  private buildCatalogReading(
    playbook: SalesPlaybookProfile,
    storeLabel: string,
    focusThemes: CatalogThemeSummary[],
  ): string {
    const themeLabels = focusThemes.map((theme) => theme.label);

    if (playbook.segment === 'confectionery') {
      if (themeLabels.length >= 3) {
        return `hoje a loja gira em ${storeLabel}, com saida forte para ${themeLabels[0]}, ${themeLabels[1]} e ${themeLabels[2]}.`;
      }

      if (themeLabels.length === 2) {
        return `hoje a loja gira em ${storeLabel}, com boa leitura para ${themeLabels[0]} e ${themeLabels[1]}.`;
      }

      return `hoje a loja gira em ${storeLabel}, com foco em vender o que esta configurado no catalogo sem chute.`;
    }

    if (themeLabels.length >= 2) {
      return `o catalogo atual esta puxando melhor para ${themeLabels[0]} e ${themeLabels[1]}.`;
    }

    return `o catalogo atual esta sendo lido a partir do que foi configurado nos produtos e categorias.`;
  }

  private buildStoreLabel(
    playbook: SalesPlaybookProfile,
    focusThemes: CatalogThemeSummary[],
    dominantCategory: string | null,
  ): string {
    if (
      playbook.segment === 'confectionery' &&
      focusThemes.some((theme) => theme.key === 'chocolate')
    ) {
      return 'chocolates e doces';
    }

    if (dominantCategory) {
      return dominantCategory.toLowerCase();
    }

    return playbook.label;
  }

  private getDominantCategory(products: ProductWithStock[]): string | null {
    const categoryCounter = new Map<string, number>();
    products.forEach((product) => {
      const category = String(product.categoria?.name || '').trim();
      if (!category) {
        return;
      }

      categoryCounter.set(category, (categoryCounter.get(category) || 0) + 1);
    });

    return Array.from(categoryCounter.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
  }

  private matchesTheme(
    product: ProductWithStock,
    theme: Pick<CatalogThemeRule, 'patterns'>,
  ): boolean {
    const document = this.buildProductSearchDocument(product);
    return theme.patterns.some((pattern) => document.includes(pattern));
  }

  private matchesThemeKey(product: ProductWithStock, key: CatalogThemeKey): boolean {
    const rule = this.themeRules.find((theme) => theme.key === key);
    return rule ? this.matchesTheme(product, rule) : false;
  }

  private getMatchedThemes(
    product: ProductWithStock,
    themes: Array<Pick<CatalogThemeSummary, 'key' | 'patterns' | 'recommendationReason'>>,
  ): Array<Pick<CatalogThemeSummary, 'key' | 'recommendationReason'>> {
    const document = this.buildProductSearchDocument(product);
    return themes.filter((theme) => theme.patterns.some((pattern) => document.includes(pattern)));
  }

  private hasTheme(
    themes: Array<Pick<CatalogThemeSummary, 'key'>>,
    key: CatalogThemeKey,
  ): boolean {
    return themes.some((theme) => theme.key === key);
  }

  private pickQuestionLabels(available: string[], preferred: string[]): string[] {
    const ordered = preferred.filter((label) => available.includes(label));
    const leftovers = available.filter((label) => !ordered.includes(label));
    return [...ordered, ...leftovers].slice(0, 3);
  }

  private collectConfectioneryConversationCues(
    profile: CatalogSalesProfile,
    analysis: SalesConversationAnalysis,
  ): ConfectioneryConversationCue[] {
    if (profile.segment !== 'confectionery') {
      return [];
    }

    const cues: ConfectioneryConversationCue[] = [];
    const text = analysis.normalizedText;
    const hasPattern = (patterns: string[]) => patterns.some((pattern) => text.includes(pattern));
    const addCue = (cue: ConfectioneryConversationCue) => {
      if (!cues.some((existing) => existing.key === cue.key)) {
        cues.push(cue);
      }
    };

    if (
      analysis.useCaseTags.includes('gift') ||
      hasPattern([
        'caixa',
        'box',
        'kit',
        'embalado',
        'pra presente',
        'para presente',
        'lembrancinha',
      ])
    ) {
      addCue({
        key: 'gift_ready',
        focusLine:
          'Para esse pedido, eu vou puxar o que faz mais sentido para presente pronto para entregar.',
        qualificationQuestion:
          'Voce quer um presente mais marcante na caixa ou algo que renda melhor sem perder capricho?',
        recommendationReason: 'encaixa melhor como presente pronto',
        preferredThemes: ['gift', 'premium', 'chocolate'],
        score: 11,
      });
    }

    if (
      analysis.useCaseTags.includes('party') ||
      analysis.useCaseTags.includes('sharing') ||
      hasPattern([
        'duzia',
        'meia duzia',
        'compartilhar',
        'dividir',
        'mesa',
        'festa',
        'evento',
        'levar para',
      ])
    ) {
      addCue({
        key: 'sharing_order',
        focusLine:
          'Para esse pedido, eu vou priorizar o que segura melhor compra para dividir ou montar volume.',
        qualificationQuestion:
          'Voce quer algo mais para dividir facil ou algo que chegue com mais impacto na mesa?',
        recommendationReason: 'segura melhor um pedido para compartilhar',
        preferredThemes: ['sharing', 'celebration', 'gift'],
        score: 10,
      });
    }

    if (
      analysis.useCaseTags.includes('chocolate_focus') ||
      hasPattern([
        'chocolate',
        'chocolatudo',
        'mais chocolate',
        'mais intenso',
        'cacau',
        'ganache',
        'trufa',
        'brownie',
        'recheado',
      ])
    ) {
      addCue({
        key: 'chocolate_focus',
        focusLine:
          'Para esse pedido, eu vou puxar o que bate mais forte em chocolate e desejo.',
        qualificationQuestion:
          'Voce quer algo mais intenso no chocolate ou mais equilibrado para agradar facil?',
        recommendationReason: 'responde melhor a uma busca mais chocolatuda',
        preferredThemes: ['chocolate', 'premium', 'self_treat'],
        score: 12,
      });
    }

    if (
      analysis.useCaseTags.includes('self_treat') ||
      hasPattern([
        'docinho',
        'mimo',
        'pra mim',
        'para mim',
        'individual',
        'unidade',
        'sobremesa',
      ])
    ) {
      addCue({
        key: 'self_treat',
        focusLine:
          'Para esse pedido, eu vou priorizar o que fecha melhor como mimo individual sem enrolacao.',
        qualificationQuestion:
          'Voce quer um mimo individual mais intenso ou algo mais leve para matar a vontade?',
        recommendationReason: 'fecha melhor como mimo individual',
        preferredThemes: ['self_treat', 'chocolate', 'premium'],
        score: 9,
      });
    }

    if (
      analysis.pricePreference === 'premium' ||
      analysis.useCaseTags.includes('premium') ||
      hasPattern([
        'premium',
        'marcante',
        'caprichado',
        'sofisticado',
        'mais bonito',
        'especial',
      ])
    ) {
      addCue({
        key: 'premium_choice',
        focusLine:
          'Para esse pedido, eu vou puxar as opcoes com cara mais premium sem perder aderencia.',
        qualificationQuestion:
          'Voce quer algo mais premium pela apresentacao ou mais premium pela intensidade do chocolate?',
        recommendationReason: 'sustenta melhor uma escolha mais marcante',
        preferredThemes: ['premium', 'gift', 'chocolate'],
        score: 8,
      });
    }

    return cues;
  }

  private collectMetadataStrings(
    metadata: Record<string, unknown> | undefined,
    depth = 0,
  ): string[] {
    if (!metadata || depth > 2) {
      return [];
    }

    const values: string[] = [];
    Object.entries(metadata).forEach(([key, value]) => {
      if (this.ignoredMetadataKeys.has(key)) {
        return;
      }

      if (typeof value === 'string') {
        if (/^https?:\/\//i.test(value)) {
          return;
        }

        values.push(value);
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string') {
            values.push(item);
          } else if (item && typeof item === 'object') {
            values.push(...this.collectMetadataStrings(item as Record<string, unknown>, depth + 1));
          }
        });
        return;
      }

      if (value && typeof value === 'object') {
        values.push(...this.collectMetadataStrings(value as Record<string, unknown>, depth + 1));
      }
    });

    return values;
  }

  private extractMetadataHint(product: ProductWithStock): string | null {
    const metadata = product.metadata || {};
    const hintKeys = ['whatsapp_hint', 'sales_pitch', 'positioning', 'flavor_profile'];

    for (const key of hintKeys) {
      const value = metadata[key];
      if (typeof value !== 'string') {
        continue;
      }

      const cleaned = value.trim();
      if (!cleaned) {
        continue;
      }

      return cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}...` : cleaned;
    }

    return null;
  }
}
