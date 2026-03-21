import { Injectable } from '@nestjs/common';
import { ProductWithStock } from '../../products/types/product.types';
import { SalesConversationAnalysis } from './sales-intelligence.service';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesPlaybookProfile, SalesPlaybookSegment } from './sales-playbook.service';

type SalesSegmentNeedRule = {
  axis: string;
  label: string;
  messagePatterns: string[];
  productPatterns: string[];
  reason: string;
  score: number;
};

type SalesSegmentStrategyDefinition = {
  segment: SalesPlaybookSegment;
  posture: string;
  comparisonFocus: string;
  budgetProtection: string;
  objectionBridge: string;
  clarifyPrompt: string;
  deepenPrompt: string;
  needRules: SalesSegmentNeedRule[];
};

export interface SalesSegmentNeed {
  axis: string;
  label: string;
  reason: string;
  score: number;
  productPatterns: string[];
}

export interface SalesConversationStrategy {
  segment: SalesPlaybookSegment;
  posture: string;
  comparisonFocus: string;
  budgetProtection: string;
  objectionBridge: string;
  clarifyPrompt: string;
  deepenPrompt: string;
  detectedNeeds: SalesSegmentNeed[];
}

export interface SalesStrategyFit {
  score: number;
  reasons: string[];
}

@Injectable()
export class SalesSegmentStrategyService {
  private readonly strategies: SalesSegmentStrategyDefinition[] = [
    {
      segment: 'confectionery',
      posture:
        'eu vendo melhor quando protejo encantamento, apresentacao e adequacao ao momento da compra.',
      comparisonFocus:
        'impacto visual, ocasiao certa e facilidade de transformar vontade em decisao rapida.',
      budgetProtection: 'encanto, apresentacao e percepcao de mimo',
      objectionBridge:
        'baixar ticket sem matar a sensacao de presente, recompensa ou indulgencia.',
      clarifyPrompt:
        'Se quiser, me diga se isso e para presente, evento ou vontade do dia que eu afino melhor.',
      deepenPrompt:
        'Se quiser, eu afino isso por presente, compartilhamento ou mimo individual.',
      needRules: [
        {
          axis: 'occasion',
          label: 'presente',
          messagePatterns: ['presente', 'presentear', 'lembrancinha', 'mimo'],
          productPatterns: ['caixa', 'box', 'kit', 'gourmet', 'premium', 'presente'],
          reason: 'tem mais forca para presentear com boa apresentacao',
          score: 14,
        },
        {
          axis: 'occasion',
          label: 'evento ou compartilhamento',
          messagePatterns: ['festa', 'aniversario', 'evento', 'comemoracao', 'compartilhar'],
          productPatterns: ['bolo', 'torta', 'duzia', 'combo', 'kit festa', 'caixa'],
          reason: 'resolve melhor um contexto de compartilhamento',
          score: 14,
        },
        {
          axis: 'consumption',
          label: 'mimo individual',
          messagePatterns: ['pra mim', 'sobremesa', 'vontade', 'docinho', 'doce'],
          productPatterns: ['brigadeiro', 'brownie', 'cookie', 'trufa'],
          reason: 'fecha bem para uma compra de desejo mais imediata',
          score: 10,
        },
      ],
    },
    {
      segment: 'fashion',
      posture:
        'eu vendo melhor quando encaixo a peca na ocasiao de uso, preservando presenca e versatilidade.',
      comparisonFocus:
        'ocasiao, caimento percebido e facilidade de encaixar a compra no look real da cliente.',
      budgetProtection: 'versatilidade, presenca e seguranca no look',
      objectionBridge:
        'segurar estilo e confianca sem empurrar ticket nem perder leitura de valor.',
      clarifyPrompt:
        'Se quiser, me diga se voce quer isso para trabalho, noite, presente ou dia a dia.',
      deepenPrompt:
        'Se quiser, eu afino por trabalho, ocasiao especial ou uso do dia a dia.',
      needRules: [
        {
          axis: 'occasion',
          label: 'uso de trabalho',
          messagePatterns: ['trabalho', 'escritorio', 'reuniao', 'profissional'],
          productPatterns: ['blazer', 'camisa', 'alfaiataria', 'social', 'calca'],
          reason: 'comunica melhor seriedade e presenca para trabalho',
          score: 14,
        },
        {
          axis: 'occasion',
          label: 'noite ou ocasiao especial',
          messagePatterns: ['noite', 'festa', 'evento', 'jantar', 'sair'],
          productPatterns: ['vestido', 'blazer', 'premium', 'festa', 'salto'],
          reason: 'tem mais leitura de impacto para a ocasiao',
          score: 12,
        },
        {
          axis: 'comfort',
          label: 'dia a dia confortavel',
          messagePatterns: ['dia a dia', 'conforto', 'leve', 'basico', 'versatil'],
          productPatterns: ['camiseta', 'basica', 'jeans', 'malha', 'linho', 'casual'],
          reason: 'encaixa melhor no uso recorrente e versatil',
          score: 12,
        },
      ],
    },
    {
      segment: 'beauty',
      posture:
        'eu vendo melhor quando conecto o produto a uma rotina clara e ao resultado que a cliente quer sentir.',
      comparisonFocus:
        'rotina, sensorial e aderencia ao tipo de uso que a cliente vai manter de verdade.',
      budgetProtection: 'resultado percebido e aderencia a rotina',
      objectionBridge:
        'reduzir ticket sem desmontar a rotina ou prometer mais do que o produto sustenta.',
      clarifyPrompt:
        'Se quiser, me diga se o foco e pele sensivel, hidratacao, glow, cabelo ou maquiagem.',
      deepenPrompt:
        'Se quiser, eu afino por rotina, sensibilidade ou resultado que voce quer priorizar.',
      needRules: [
        {
          axis: 'skin',
          label: 'pele sensivel',
          messagePatterns: ['pele sensivel', 'sensivel', 'irrita', 'sem fragrancia'],
          productPatterns: ['sensivel', 'suave', 'dermo', 'sem fragrancia', 'calmante'],
          reason: 'tem leitura mais segura para pele sensivel',
          score: 14,
        },
        {
          axis: 'routine',
          label: 'hidratacao e glow',
          messagePatterns: ['hidratacao', 'hidratar', 'glow', 'viço', 'brilho'],
          productPatterns: ['hidratante', 'serum', 'glow', 'nutritivo', 'oleo'],
          reason: 'conversa melhor com rotina de hidratacao e luminosidade',
          score: 12,
        },
        {
          axis: 'hair',
          label: 'cuidado capilar',
          messagePatterns: ['cabelo', 'ressecado', 'queda', 'frizz', 'capilar'],
          productPatterns: ['shampoo', 'condicionador', 'mascara', 'reconstrucao', 'nutricao'],
          reason: 'se encaixa melhor na rotina capilar descrita',
          score: 12,
        },
      ],
    },
    {
      segment: 'optical',
      posture:
        'eu vendo melhor quando protejo conforto visual e deixo claro o contexto de uso da armacao ou da lente.',
      comparisonFocus:
        'protecao, conforto no uso e presenca da armacao para o contexto certo.',
      budgetProtection: 'conforto visual e protecao real',
      objectionBridge:
        'segurar o ticket sem perder seguranca de uso nem forcar uma armacao errada.',
      clarifyPrompt:
        'Se quiser, me diga se isso e para sol, dirigir, tela, trabalho ou presenca visual.',
      deepenPrompt:
        'Se quiser, eu afino por protecao, leveza ou estilo de armacao.',
      needRules: [
        {
          axis: 'protection',
          label: 'sol e protecao',
          messagePatterns: ['sol', 'praia', 'rua', 'claridade', 'dirigir'],
          productPatterns: ['solar', 'uv', 'polarizado', 'protecao'],
          reason: 'protege melhor para uso no sol e deslocamento',
          score: 13,
        },
        {
          axis: 'screen',
          label: 'tela e trabalho',
          messagePatterns: ['tela', 'computador', 'trabalho', 'escritorio'],
          productPatterns: ['lente', 'blue', 'antirreflexo', 'leve'],
          reason: 'faz mais sentido para rotina com tela e uso prolongado',
          score: 12,
        },
        {
          axis: 'style',
          label: 'presenca de armacao',
          messagePatterns: ['estilo', 'marcante', 'elegante', 'presenca'],
          productPatterns: ['armacao', 'premium', 'metal', 'acetato'],
          reason: 'ganha mais em presenca visual da armacao',
          score: 10,
        },
      ],
    },
    {
      segment: 'wellness',
      posture:
        'eu vendo melhor quando encaixo o item numa rotina recorrente, segura e simples de manter.',
      comparisonFocus:
        'consistencia de uso, praticidade e aderencia a uma rotina de cuidado recorrente.',
      budgetProtection: 'constancia de cuidado e seguranca de uso',
      objectionBridge:
        'baixar ticket sem quebrar a rotina nem virar uma compra sem continuidade.',
      clarifyPrompt:
        'Se quiser, me diga se o foco e rotina diaria, energia, cuidado sensivel ou uso pontual.',
      deepenPrompt:
        'Se quiser, eu afino por rotina, intensidade de uso ou perfil de cuidado.',
      needRules: [
        {
          axis: 'routine',
          label: 'uso recorrente',
          messagePatterns: ['todo dia', 'diario', 'rotina', 'constante', 'continuo'],
          productPatterns: ['uso diario', 'capsula', 'vitamina', 'suplemento', 'higiene'],
          reason: 'tem mais aderencia para rotina recorrente',
          score: 12,
        },
        {
          axis: 'sensitive',
          label: 'cuidado mais sensivel',
          messagePatterns: ['sensivel', 'leve', 'suave', 'delicado'],
          productPatterns: ['suave', 'sensivel', 'dermo', 'higiene', 'protecao'],
          reason: 'faz mais sentido para cuidado mais sensivel',
          score: 11,
        },
      ],
    },
    {
      segment: 'pet',
      posture:
        'eu vendo melhor quando conecto a recomendacao ao perfil do animal e a rotina real da casa.',
      comparisonFocus:
        'porte, fase de vida e praticidade da rotina do pet para nao indicar algo fora do perfil.',
      budgetProtection: 'aderencia do pet e rotina pratica para o tutor',
      objectionBridge:
        'segurar o ticket sem trocar por algo que o pet nao vai aderir ou que complique a rotina.',
      clarifyPrompt:
        'Se quiser, me diga se e para cachorro, gato, filhote, adulto, alimentacao ou higiene.',
      deepenPrompt:
        'Se quiser, eu afino por porte, fase de vida ou rotina do pet.',
      needRules: [
        {
          axis: 'species',
          label: 'perfil de cachorro',
          messagePatterns: ['cachorro', 'cao', 'dog', 'doguinho'],
          productPatterns: ['cao', 'cachorro', 'porte', 'coleira'],
          reason: 'fica mais aderente a uma rotina de cachorro',
          score: 12,
        },
        {
          axis: 'species',
          label: 'perfil de gato',
          messagePatterns: ['gato', 'gatinho', 'felino'],
          productPatterns: ['gato', 'areia', 'felino'],
          reason: 'conversa melhor com rotina de gato',
          score: 12,
        },
        {
          axis: 'lifeStage',
          label: 'filhote ou fase inicial',
          messagePatterns: ['filhote', 'novo', 'inicio'],
          productPatterns: ['filhote', 'junior', 'inicio'],
          reason: 'combina mais com fase inicial do pet',
          score: 13,
        },
        {
          axis: 'routine',
          label: 'alimentacao e recompensa',
          messagePatterns: ['petisco', 'racao', 'comida', 'alimentacao'],
          productPatterns: ['racao', 'petisco', 'sache', 'snack'],
          reason: 'resolve melhor a rotina de alimentacao ou recompensa',
          score: 11,
        },
      ],
    },
    {
      segment: 'restaurant',
      posture:
        'eu vendo melhor quando fecho fome, momento de consumo e ticket sem deixar a escolha cansativa.',
      comparisonFocus:
        'saciedade, velocidade de decisao e composicao do pedido para aquele momento.',
      budgetProtection: 'saciedade, praticidade e sensacao de refeicao completa',
      objectionBridge:
        'ajustar ticket sem desmontar a refeicao nem deixar a compra parecer incompleta.',
      clarifyPrompt:
        'Se quiser, me diga se e para almoco, jantar, lanche rapido, dividir ou matar a fome com mais sustancia.',
      deepenPrompt:
        'Se quiser, eu afino por fome, momento do dia ou pedido para dividir.',
      needRules: [
        {
          axis: 'moment',
          label: 'almoco ou refeicao principal',
          messagePatterns: ['almoco', 'jantar', 'refeicao', 'fome', 'sustancia'],
          productPatterns: ['executivo', 'marmita', 'prato', 'combo', 'refeicao'],
          reason: 'resolve melhor uma refeicao principal',
          score: 13,
        },
        {
          axis: 'speed',
          label: 'lanche rapido',
          messagePatterns: ['rapido', 'correria', 'lanche', 'agora'],
          productPatterns: ['lanche', 'hamburguer', 'sanduiche', 'combo'],
          reason: 'fecha mais rapido para um momento de lanche',
          score: 12,
        },
        {
          axis: 'sharing',
          label: 'dividir ou compartilhar',
          messagePatterns: ['dividir', 'compartilhar', 'duas pessoas', 'familia'],
          productPatterns: ['familia', 'combo', 'porcao', 'pizza', 'kit'],
          reason: 'faz mais sentido para dividir',
          score: 12,
        },
      ],
    },
    {
      segment: 'electronics',
      posture:
        'eu vendo melhor quando conecto argumento tecnico com compatibilidade e uso pratico no mundo real.',
      comparisonFocus:
        'compatibilidade, desempenho percebido e ganho pratico para o tipo de uso do cliente.',
      budgetProtection: 'compatibilidade e desempenho util de verdade',
      objectionBridge:
        'segurar o ticket sem sacrificar compatibilidade ou comprar algo fraco para o uso.',
      clarifyPrompt:
        'Se quiser, me diga se isso e para iphone, android, notebook, bateria, velocidade ou uso no dia a dia.',
      deepenPrompt:
        'Se quiser, eu afino por compatibilidade, desempenho ou praticidade.',
      needRules: [
        {
          axis: 'compatibility',
          label: 'compatibilidade com iphone',
          messagePatterns: ['iphone', 'ios', 'lightning'],
          productPatterns: ['iphone', 'lightning', 'ios'],
          reason: 'fica mais seguro para compatibilidade com iphone',
          score: 14,
        },
        {
          axis: 'compatibility',
          label: 'compatibilidade com android',
          messagePatterns: ['android', 'usb c', 'tipo c', 'type c'],
          productPatterns: ['usb c', 'tipo c', 'type c', 'android'],
          reason: 'fica mais seguro para compatibilidade com android',
          score: 14,
        },
        {
          axis: 'performance',
          label: 'carga e desempenho',
          messagePatterns: ['rapido', 'turbo', 'bateria', 'desempenho', 'potente'],
          productPatterns: ['turbo', 'bateria', 'rapido', 'potencia', 'ssd', 'memoria'],
          reason: 'entrega argumento tecnico mais forte para desempenho',
          score: 12,
        },
      ],
    },
    {
      segment: 'home',
      posture:
        'eu vendo melhor quando ligo a compra ao ambiente, ao espaco disponivel e ao uso que a casa pede.',
      comparisonFocus:
        'espaco, impacto visual e praticidade real no ambiente em que o item vai entrar.',
      budgetProtection: 'uso pratico e presenca no ambiente',
      objectionBridge:
        'baixar ticket sem transformar a compra em algo sem utilidade ou sem presenca.',
      clarifyPrompt:
        'Se quiser, me diga se isso e para organizar, decorar, espaco pequeno, cozinha, quarto ou sala.',
      deepenPrompt:
        'Se quiser, eu afino por ambiente, tamanho do espaco ou impacto visual.',
      needRules: [
        {
          axis: 'space',
          label: 'espaco pequeno',
          messagePatterns: ['apartamento', 'pequeno', 'compacto', 'pouco espaco'],
          productPatterns: ['compacto', 'modular', 'multiuso', 'organizador'],
          reason: 'aproveita melhor espacos menores',
          score: 13,
        },
        {
          axis: 'decor',
          label: 'decoracao e presenca',
          messagePatterns: ['decorar', 'bonito', 'aconchego', 'estilo', 'ambiente'],
          productPatterns: ['decor', 'design', 'almofada', 'lampada', 'premium'],
          reason: 'entrega mais presenca visual no ambiente',
          score: 11,
        },
        {
          axis: 'utility',
          label: 'organizacao e praticidade',
          messagePatterns: ['organizar', 'arrumar', 'praticidade', 'funcional'],
          productPatterns: ['organizador', 'multiuso', 'cozinha', 'modular'],
          reason: 'resolve melhor a rotina e a organizacao da casa',
          score: 12,
        },
      ],
    },
    {
      segment: 'general',
      posture:
        'eu vendo melhor quando descubro rapido o uso principal, protejo valor percebido e facilito a decisao.',
      comparisonFocus:
        'uso real, praticidade e clareza para fechar uma decisao sem empurrar produto.',
      budgetProtection: 'valor percebido e adequacao ao uso principal',
      objectionBridge:
        'reencaixar a compra com seguranca, sem forcar a venda nem desmontar o que mais importa.',
      clarifyPrompt:
        'Se quiser, me diga o uso principal, a faixa de valor ou para quem e a compra que eu afino melhor.',
      deepenPrompt:
        'Se quiser, eu afino isso por uso, ticket ou perfil de quem vai receber.',
      needRules: [],
    },
  ];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  buildStrategy(
    playbook: SalesPlaybookProfile,
    analysis: SalesConversationAnalysis,
  ): SalesConversationStrategy {
    const definition = this.getDefinition(playbook.segment);
    const detectedNeeds = definition.needRules
      .filter((rule) => this.matchesRule(analysis.normalizedText, rule))
      .map((rule) => ({
        axis: rule.axis,
        label: rule.label,
        reason: rule.reason,
        score: rule.score,
        productPatterns: rule.productPatterns,
      }))
      .sort((left, right) => right.score - left.score);

    return {
      segment: definition.segment,
      posture: definition.posture,
      comparisonFocus: definition.comparisonFocus,
      budgetProtection: definition.budgetProtection,
      objectionBridge: definition.objectionBridge,
      clarifyPrompt: definition.clarifyPrompt,
      deepenPrompt: definition.deepenPrompt,
      detectedNeeds,
    };
  }

  scoreProductForStrategy(
    product: ProductWithStock,
    strategy: SalesConversationStrategy,
  ): SalesStrategyFit {
    if (!strategy.detectedNeeds.length) {
      return { score: 0, reasons: [] };
    }

    const document = this.normalize(
      [
        product.name,
        product.description || '',
        product.categoria?.name || '',
        product.sku || '',
        product.unit || '',
      ].join(' '),
    );

    let score = 0;
    const reasons: string[] = [];

    strategy.detectedNeeds.forEach((need) => {
      const matches = need.productPatterns.some((pattern) =>
        document.includes(this.normalize(pattern)),
      );

      if (!matches) {
        return;
      }

      score += need.score;
      if (!reasons.includes(need.reason)) {
        reasons.push(need.reason);
      }
    });

    return { score, reasons };
  }

  buildStrategyContext(
    playbook: SalesPlaybookProfile,
    strategy: SalesConversationStrategy,
  ): string {
    if (!strategy.detectedNeeds.length) {
      return `Estrategia da ${playbook.label}: ${strategy.posture}`;
    }

    return `Estrategia da ${playbook.label}: ${strategy.posture} Aqui eu priorizei ${this.joinNaturally(
      strategy.detectedNeeds.slice(0, 2).map((need) => need.label),
    )}.`;
  }

  buildComparisonContext(strategy: SalesConversationStrategy): string {
    if (!strategy.detectedNeeds.length) {
      return `Foco estrategico: ${strategy.comparisonFocus}`;
    }

    return `Foco estrategico: ${strategy.comparisonFocus} Considerei ${this.joinNaturally(
      strategy.detectedNeeds.slice(0, 2).map((need) => need.label),
    )}.`;
  }

  buildBudgetBridge(strategy: SalesConversationStrategy): string {
    return `Mesmo ajustando o ticket, eu tentaria preservar ${strategy.budgetProtection}.`;
  }

  buildRecommendationRefinement(strategy: SalesConversationStrategy): string {
    return strategy.detectedNeeds.length ? strategy.deepenPrompt : strategy.clarifyPrompt;
  }

  private getDefinition(segment: SalesPlaybookSegment): SalesSegmentStrategyDefinition {
    return (
      this.strategies.find((strategy) => strategy.segment === segment) ||
      this.strategies.find((strategy) => strategy.segment === 'general')
    ) as SalesSegmentStrategyDefinition;
  }

  private matchesRule(normalizedText: string, rule: SalesSegmentNeedRule): boolean {
    return rule.messagePatterns.some((pattern) => normalizedText.includes(this.normalize(pattern)));
  }

  private normalize(value: string): string {
    return this.messageIntelligenceService.normalizeText(value || '');
  }

  private joinNaturally(items: string[]): string {
    if (!items.length) {
      return 'o contexto principal da compra';
    }

    if (items.length === 1) {
      return items[0];
    }

    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  }
}
