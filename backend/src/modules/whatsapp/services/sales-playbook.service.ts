import { Injectable } from '@nestjs/common';
import { ProductWithStock } from '../../products/types/product.types';
import { SalesConversationAnalysis } from './sales-intelligence.service';
import { MessageIntelligenceService } from './message-intelligence.service';

export type SalesPlaybookSegment =
  | 'confectionery'
  | 'fashion'
  | 'beauty'
  | 'optical'
  | 'wellness'
  | 'pet'
  | 'restaurant'
  | 'electronics'
  | 'home'
  | 'general';

type PlaybookSignalRule = {
  productPatterns: string[];
  queryPatterns?: string[];
  useCaseTags?: string[];
  reason: string;
  score: number;
};

type SalesPlaybookDefinition = {
  segment: SalesPlaybookSegment;
  label: string;
  keywords: string[];
  salesLens: string;
  recommendationIntro: {
    default: string;
    gift?: string;
    party?: string;
    budget: string;
    objection: string;
    queryPrefix?: string;
  };
  recommendationClose: {
    default: string;
    objection?: string;
    budgetMiss: string;
  };
  comparisonLabels: {
    cheaper: string;
    premium: string;
    betterValue: string;
    recommendationLead: string;
  };
  productSignals: PlaybookSignalRule[];
};

export interface SalesPlaybookProfile extends SalesPlaybookDefinition {
  confidence: number;
}

export interface SalesPlaybookFit {
  score: number;
  reasons: string[];
}

@Injectable()
export class SalesPlaybookService {
  private readonly playbooks: SalesPlaybookDefinition[] = [
    {
      segment: 'confectionery',
      label: 'confeitaria',
      keywords: [
        'brigadeiro',
        'brownie',
        'bolo',
        'torta',
        'cookie',
        'doces',
        'sobremesa',
        'trufa',
        'chocolate',
        'gourmet',
      ],
      salesLens: 'Eu compararia pensando em desejo, presente e facilidade de giro.',
      recommendationIntro: {
        default: 'Pensando como uma consultora de confeitaria, eu separaria estas opcoes para encantar e converter bem:',
        gift: 'Pensando em presentear bem, separei algumas opcoes que costumam encantar logo na primeira impressao:',
        party: 'Para esse contexto de evento, estas sao as opcoes que melhor resolvem compartilhamento e impacto:',
        budget: 'Pensando no seu teto e sem perder apelo de desejo, estas sao as opcoes mais inteligentes agora:',
        objection: 'Entendi a preocupacao com custo. Para manter a venda gostosa sem derrubar a percepcao de valor, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as melhores opcoes de confeitaria que eu colocaria na frente do cliente:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo duas opcoes, ajusto por ocasiao ou ja transformo isso em pedido por aqui.',
        objection:
          'Se quiser, eu tambem comparo com o item que voce tinha em mente para mostrar o ganho de valor com clareza.',
        budgetMiss:
          'Se quiser, eu abro outra faixa de valor ou priorizo algo mais presenteavel, mais indulgente ou mais facil de girar.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais presenteavel',
        betterValue: 'Melhor equilibrio agora',
        recommendationLead: 'Se eu fosse fechar essa venda com mais encantamento, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['gourmet', 'premium', 'caixa', 'box', 'kit', 'combo'],
          useCaseTags: ['gift'],
          reason: 'tem apelo forte para presente',
          score: 13,
        },
        {
          productPatterns: ['bolo', 'torta', 'kit festa', 'duzia', 'combo'],
          useCaseTags: ['party'],
          reason: 'resolve melhor compra para compartilhar',
          score: 12,
        },
        {
          productPatterns: ['chocolate', 'brownie', 'brigadeiro', 'cookie', 'recheado'],
          reason: 'entrega desejo e saida facil na conversa',
          score: 8,
        },
      ],
    },
    {
      segment: 'fashion',
      label: 'moda',
      keywords: [
        'camiseta',
        'camisa',
        'vestido',
        'calca',
        'jeans',
        'saia',
        'blazer',
        'tenis',
        'sapato',
        'bolsa',
        'look',
        'roupa',
      ],
      salesLens: 'Eu compararia olhando presenca, versatilidade e facilidade de encaixe no look.',
      recommendationIntro: {
        default: 'Pensando como consultora de moda, eu colocaria estas opcoes na frente do cliente para girar com seguranca:',
        budget: 'Pensando no seu teto e sem perder presenca no look, estas sao as melhores rotas agora:',
        objection: 'Entendi a pressao de preco. Para segurar a venda sem perder estilo nem percepcao, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, como consultora de moda eu mostraria estas pecas primeiro para facilitar a decisao:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo caimento, ocasiao de uso ou ticket para ja fechar a melhor opcao.',
        objection:
          'Se quiser, eu comparo com a peca mais cara para te mostrar onde esta o melhor giro sem forcar a venda.',
        budgetMiss:
          'Se quiser, eu recalculo dentro de outra faixa ou priorizo algo mais versatil, mais marcante ou mais facil de girar.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais marcante',
        betterValue: 'Mais versatil agora',
        recommendationLead: 'Se eu fosse montar um look com melhor giro, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['basico', 'casual', 'jeans', 'camiseta', 'versatil'],
          queryPatterns: ['dia a dia', 'todo dia', 'versatil'],
          reason: 'entra bem no uso do dia a dia',
          score: 12,
        },
        {
          productPatterns: ['vestido', 'blazer', 'alfaiataria', 'premium', 'festa'],
          reason: 'eleva presenca e percepcao de valor',
          score: 10,
        },
        {
          productPatterns: ['conforto', 'leve', 'malha', 'cotton', 'linho'],
          reason: 'equilibra caimento e conforto',
          score: 8,
        },
      ],
    },
    {
      segment: 'beauty',
      label: 'beleza',
      keywords: [
        'serum',
        'hidratante',
        'perfume',
        'skincare',
        'maquiagem',
        'batom',
        'base',
        'protetor',
        'shampoo',
        'condicionador',
      ],
      salesLens: 'Eu compararia isso olhando rotina, percepcao sensorial e resultado percebido.',
      recommendationIntro: {
        default: 'Pensando como consultora de beleza, estas sao as opcoes que eu puxaria para uma venda mais segura:',
        budget: 'Pensando no seu teto e sem perder resultado percebido, estas sao as melhores opcoes agora:',
        objection: 'Entendi a objecao de preco. Para manter a venda forte sem perder sensacao de cuidado, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as opcoes que melhor conversam com essa rotina de cuidado:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo rotina, acabamento ou sensorial e ja te levo para a melhor escolha.',
        objection:
          'Se quiser, eu comparo com o item mais caro para te mostrar o melhor custo de rotina sem perder qualidade.',
        budgetMiss:
          'Se quiser, eu abro outra faixa de valor ou priorizo algo mais completo, mais sensorial ou mais seguro para uso recorrente.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais sensorial',
        betterValue: 'Melhor rotina agora',
        recommendationLead: 'Se eu fosse fechar pensando em rotina e recompra, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['hidratante', 'serum', 'tratamento', 'protetor', 'fps', 'limpeza'],
          reason: 'faz sentido em rotina de cuidado',
          score: 11,
        },
        {
          productPatterns: ['suave', 'dermo', 'sem fragrancia', 'sensivel'],
          queryPatterns: ['pele sensivel', 'sensivel'],
          reason: 'conversa melhor com pele mais sensivel',
          score: 11,
        },
        {
          productPatterns: ['premium', 'luxo', 'perfume', 'glow', 'acabamento'],
          reason: 'eleva a percepcao sensorial da compra',
          score: 8,
        },
      ],
    },
    {
      segment: 'optical',
      label: 'otica',
      keywords: [
        'oculos',
        'lente',
        'armacao',
        'solar',
        'grau',
        'polarizado',
        'uv',
        'visao',
      ],
      salesLens: 'Eu compararia isso olhando conforto visual, protecao e presenca de armacao.',
      recommendationIntro: {
        default: 'Pensando como atendimento de otica, estas sao as opcoes que eu mostraria primeiro:',
        budget: 'Pensando no seu teto e sem perder conforto visual, estas sao as melhores rotas agora:',
        objection: 'Entendi a objecao de preco. Para segurar a venda sem perder protecao nem percepcao de qualidade, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as opcoes que melhor equilibram conforto, protecao e estilo:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo protecao, leveza ou presenca da armacao e ja te levo para a melhor escolha.',
        objection:
          'Se quiser, eu comparo com a opcao mais cara para te mostrar onde esta o melhor conforto visual sem estourar o ticket.',
        budgetMiss:
          'Se quiser, eu recalculo em outra faixa ou priorizo algo mais leve, mais protegido ou mais sofisticado.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais sofisticado',
        betterValue: 'Melhor conforto visual',
        recommendationLead: 'Se eu fosse fechar pensando em conforto e protecao, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['uv', 'polarizado', 'protecao', 'lente', 'solar'],
          reason: 'fortalece argumento de protecao visual',
          score: 11,
        },
        {
          productPatterns: ['leve', 'conforto', 'ajuste', 'armacao'],
          reason: 'ganha em conforto no uso',
          score: 9,
        },
      ],
    },
    {
      segment: 'wellness',
      label: 'bem-estar',
      keywords: [
        'vitamina',
        'suplemento',
        'proteina',
        'farmacia',
        'higiene',
        'dermocosmetico',
        'alivio',
        'capsula',
      ],
      salesLens: 'Eu compararia pensando em cuidado recorrente, seguranca e rotina de uso.',
      recommendationIntro: {
        default: 'Pensando como atendimento de bem-estar, estas sao as opcoes que eu puxaria primeiro:',
        budget: 'Pensando no seu teto e sem perder consistencia de cuidado, estas sao as melhores opcoes agora:',
        objection: 'Entendi a objecao de preco. Para manter a venda forte sem comprometer a rotina de cuidado, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as opcoes que melhor equilibram rotina, seguranca e valor:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo rotina, intensidade ou frequencia de uso para ja fechar a melhor opcao.',
        objection:
          'Se quiser, eu comparo com a opcao mais cara para mostrar onde esta o melhor custo de cuidado recorrente.',
        budgetMiss:
          'Se quiser, eu recalculo em outra faixa ou priorizo algo mais completo, mais leve no bolso ou mais alinhado a uso continuo.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais completo',
        betterValue: 'Melhor cuidado recorrente',
        recommendationLead: 'Se eu fosse fechar pensando em rotina e constancia, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['vitamina', 'suplemento', 'proteina', 'capsula', 'uso diario'],
          reason: 'se encaixa bem em rotina recorrente',
          score: 11,
        },
        {
          productPatterns: ['higiene', 'protecao', 'sensivel', 'dermo', 'suave'],
          reason: 'fortalece argumento de cuidado seguro',
          score: 9,
        },
      ],
    },
    {
      segment: 'pet',
      label: 'pet',
      keywords: [
        'racao',
        'petisco',
        'coleira',
        'areia',
        'brinquedo',
        'pet',
        'cao',
        'gato',
        'filhote',
      ],
      salesLens: 'Eu compararia olhando rotina do pet, adequacao ao perfil do animal e percepcao de cuidado.',
      recommendationIntro: {
        default: 'Pensando como atendimento pet, estas sao as opcoes que eu puxaria para vender com mais seguranca:',
        budget: 'Pensando no seu teto e sem perder adequacao para o pet, estas sao as melhores rotas agora:',
        objection: 'Entendi a objecao de preco. Para manter a venda sem comprometer a rotina do pet, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as opcoes que melhor equilibram rotina, adequacao e valor para o pet:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo porte, fase de vida ou tipo de rotina e ja te levo para a melhor escolha.',
        objection:
          'Se quiser, eu comparo com a opcao mais cara para mostrar onde esta o melhor custo sem perder aderencia do pet.',
        budgetMiss:
          'Se quiser, eu recalculo em outra faixa ou priorizo algo mais completo, mais pratico ou mais alinhado ao perfil do animal.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais completo',
        betterValue: 'Melhor rotina do pet',
        recommendationLead: 'Se eu fosse fechar pensando em aderencia e rotina do pet, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['racao', 'petisco', 'snack', 'sache', 'nutri'],
          reason: 'ajuda na rotina do pet',
          score: 11,
        },
        {
          productPatterns: ['filhote', 'adulto', 'senior', 'porte', 'gato', 'cao'],
          reason: 'fica mais alinhado ao perfil do animal',
          score: 10,
        },
      ],
    },
    {
      segment: 'restaurant',
      label: 'alimentacao',
      keywords: [
        'lanche',
        'hamburguer',
        'pizza',
        'marmita',
        'combo',
        'porcao',
        'refeicao',
        'suco',
        'jantar',
      ],
      salesLens: 'Eu compararia olhando fome resolvida, composicao do combo e ticket final.',
      recommendationIntro: {
        default: 'Pensando como atendimento de alimentacao, estas sao as opcoes que eu puxaria para fechar bem essa venda:',
        budget: 'Pensando no seu teto e sem perder saciedade nem percepcao de combo, estas sao as melhores rotas agora:',
        objection: 'Entendi a objecao de preco. Para manter a venda forte sem derrubar a percepcao da refeicao, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as opcoes que melhor equilibram saciedade, praticidade e ticket:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo combo, tamanho ou ticket e ja monto o pedido por aqui.',
        objection:
          'Se quiser, eu comparo com a opcao mais cara para mostrar onde esta o melhor valor por refeicao.',
        budgetMiss:
          'Se quiser, eu recalculo em outra faixa ou priorizo algo mais completo, mais rapido ou mais forte em ticket.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais completo',
        betterValue: 'Melhor refeicao agora',
        recommendationLead: 'Se eu fosse fechar pensando em ticket e satisfacao, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['combo', 'duplo', 'familia', 'executivo', 'kit'],
          reason: 'fecha melhor ticket e saciedade',
          score: 11,
        },
        {
          productPatterns: ['artesanal', 'premium', 'especial', 'molho', 'grelhado'],
          reason: 'aumenta percepcao de sabor e valor',
          score: 8,
        },
      ],
    },
    {
      segment: 'electronics',
      label: 'eletronicos',
      keywords: [
        'celular',
        'fone',
        'notebook',
        'carregador',
        'cabo',
        'bateria',
        'memoria',
        'ssd',
        'bluetooth',
      ],
      salesLens: 'Eu compararia olhando argumento tecnico, praticidade e percepcao de desempenho.',
      recommendationIntro: {
        default: 'Pensando como atendimento de eletronicos, estas sao as opcoes que eu puxaria primeiro:',
        budget: 'Pensando no seu teto e sem perder argumento tecnico forte, estas sao as melhores rotas agora:',
        objection: 'Entendi a objecao de preco. Para manter a venda forte sem perder argumento tecnico, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as opcoes que melhor equilibram desempenho, praticidade e valor:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo desempenho, bateria ou praticidade e ja te levo para a melhor escolha.',
        objection:
          'Se quiser, eu comparo com a opcao mais cara para mostrar onde esta o melhor custo tecnico.',
        budgetMiss:
          'Se quiser, eu recalculo em outra faixa ou priorizo algo mais parrudo, mais pratico ou com melhor custo tecnico.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais parrudo',
        betterValue: 'Melhor custo tecnico',
        recommendationLead: 'Se eu fosse fechar pensando em argumento tecnico e giro, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['bateria', 'turbo', 'rapido', 'bluetooth', 'ssd', 'memoria'],
          reason: 'entrega argumento tecnico mais forte',
          score: 11,
        },
        {
          productPatterns: ['compacto', 'pratico', 'portatil', 'leve'],
          reason: 'ganha em praticidade no uso',
          score: 8,
        },
      ],
    },
    {
      segment: 'home',
      label: 'casa',
      keywords: [
        'mesa',
        'cadeira',
        'almofada',
        'decor',
        'organiz',
        'lampada',
        'sofa',
        'cozinha',
        'cama',
      ],
      salesLens: 'Eu compararia olhando praticidade, presenca no ambiente e durabilidade percebida.',
      recommendationIntro: {
        default: 'Pensando como atendimento de casa e decoracao, estas sao as opcoes que eu puxaria primeiro:',
        budget: 'Pensando no seu teto e sem perder praticidade nem presenca no ambiente, estas sao as melhores rotas agora:',
        objection: 'Entendi a objecao de preco. Para manter a venda forte sem perder utilidade nem percepcao, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as opcoes que melhor equilibram praticidade, presenca e valor:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo praticidade, ambiente de uso ou presenca visual e ja te levo para a melhor escolha.',
        objection:
          'Se quiser, eu comparo com a opcao mais cara para mostrar onde esta o melhor valor percebido para o ambiente.',
        budgetMiss:
          'Se quiser, eu recalculo em outra faixa ou priorizo algo mais pratico, mais marcante ou mais duravel.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais marcante',
        betterValue: 'Melhor praticidade agora',
        recommendationLead: 'Se eu fosse fechar pensando em uso e percepcao no ambiente, eu iria de',
      },
      productSignals: [
        {
          productPatterns: ['organizador', 'multiuso', 'modular', 'compacto'],
          reason: 'ganha muito em praticidade',
          score: 11,
        },
        {
          productPatterns: ['decor', 'design', 'premium', 'conforto', 'duravel'],
          reason: 'eleva a percepcao do ambiente',
          score: 8,
        },
      ],
    },
    {
      segment: 'general',
      label: 'varejo',
      keywords: [],
      salesLens: 'Eu compararia olhando giro, praticidade e percepcao de valor.',
      recommendationIntro: {
        default: 'Pensando como uma vendedora consultiva, eu separaria estas opcoes para voce:',
        budget: 'Pensando no seu teto, estas sao as opcoes mais inteligentes agora:',
        objection: 'Entendi a preocupacao com custo. Para manter a venda forte sem forcar a barra, eu seguiria por aqui:',
        queryPrefix: 'Pelo que voce descreveu, estas sao as melhores rotas que achei:',
      },
      recommendationClose: {
        default: 'Se quiser, eu comparo duas opcoes, ajusto por orcamento ou ja monto o pedido por aqui.',
        objection:
          'Se quiser, eu tambem comparo com o item que voce tinha em mente para te mostrar a diferenca com clareza.',
        budgetMiss:
          'Se quiser, eu tento abrir outra faixa de valor ou comparo essas opcoes com voce.',
      },
      comparisonLabels: {
        cheaper: 'Mais acessivel',
        premium: 'Mais premium',
        betterValue: 'Melhor equilibrio agora',
        recommendationLead: 'Se eu fosse te orientar para fechar bem essa venda, eu iria de',
      },
      productSignals: [],
    },
  ];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  inferPlaybook(products: ProductWithStock[]): SalesPlaybookProfile {
    const normalizedProducts = products.map((product) => this.buildProductDocument(product));
    const scored = this.playbooks
      .map((playbook) => ({
        playbook,
        ...this.scoreCatalogForPlaybook(playbook, normalizedProducts),
      }))
      .sort((left, right) => right.score - left.score);

    const best = scored[0];
    const runnerUp = scored[1];

    if (
      !best ||
      best.score < 6 ||
      (best.uniqueHits < 2 && best.matchedProducts < 2) ||
      best.score <= (runnerUp?.score || 0) + 2
    ) {
      return { ...this.getGeneralPlaybook(), confidence: 0.45 };
    }

    const confidence = Number(
      Math.max(
        0.55,
        Math.min(
          0.96,
          (best.score + 4) / Math.max(best.score + (runnerUp?.score || 0) + 6, 1),
        ),
      ).toFixed(2),
    );

    return {
      ...best.playbook,
      confidence,
    };
  }

  describeProductFit(
    playbook: SalesPlaybookProfile,
    product: ProductWithStock,
    analysis: SalesConversationAnalysis,
  ): SalesPlaybookFit {
    const normalizedProduct = this.buildProductDocument(product);
    let score = 0;
    const reasons: string[] = [];

    for (const signal of playbook.productSignals) {
      const matchesProduct = signal.productPatterns.some((pattern) =>
        normalizedProduct.includes(this.normalize(pattern)),
      );

      if (!matchesProduct) {
        continue;
      }

      if (signal.useCaseTags?.length) {
        const matchesUseCase = signal.useCaseTags.some((tag) => analysis.useCaseTags.includes(tag));
        if (!matchesUseCase) {
          continue;
        }
      }

      if (signal.queryPatterns?.length) {
        const matchesQuery = signal.queryPatterns.some((pattern) =>
          analysis.normalizedText.includes(this.normalize(pattern)),
        );
        if (!matchesQuery) {
          continue;
        }
      }

      score += signal.score;
      if (!reasons.includes(signal.reason)) {
        reasons.push(signal.reason);
      }
    }

    return { score, reasons };
  }

  buildRecommendationIntro(
    playbook: SalesPlaybookProfile,
    analysis: SalesConversationAnalysis,
  ): string {
    if (analysis.intent === 'budget' && analysis.budgetCeiling !== null) {
      return `${playbook.recommendationIntro.budget.replace(
        /:$/,
        '',
      )} dentro do teto de ate R$ ${this.formatCurrency(analysis.budgetCeiling)}:`;
    }

    if (analysis.intent === 'objection') {
      return playbook.recommendationIntro.objection.includes('preocupacao com custo')
        ? playbook.recommendationIntro.objection
        : `Entendi a preocupacao com custo. ${playbook.recommendationIntro.objection}`;
    }

    if (analysis.useCaseTags.includes('gift')) {
      return (
        playbook.recommendationIntro.gift ||
        'Separei algumas opcoes que fazem sentido para esse contexto de presente:'
      );
    }

    if (analysis.useCaseTags.includes('party')) {
      return (
        playbook.recommendationIntro.party ||
        'Estas sao as opcoes que fazem mais sentido para esse contexto:'
      );
    }

    if (analysis.commercialQuery && playbook.recommendationIntro.queryPrefix) {
      return playbook.recommendationIntro.queryPrefix;
    }

    return playbook.recommendationIntro.default;
  }

  buildRecommendationClose(
    playbook: SalesPlaybookProfile,
    analysis: SalesConversationAnalysis,
    referenceProduct?: ProductWithStock | null,
  ): string {
    if (analysis.intent === 'objection' && referenceProduct && playbook.recommendationClose.objection) {
      return playbook.recommendationClose.objection;
    }

    return playbook.recommendationClose.default;
  }

  buildBudgetMissClose(playbook: SalesPlaybookProfile): string {
    return playbook.recommendationClose.budgetMiss;
  }

  getComparisonLabels(playbook: SalesPlaybookProfile): SalesPlaybookProfile['comparisonLabels'] {
    return playbook.comparisonLabels;
  }

  private getGeneralPlaybook(): SalesPlaybookDefinition {
    return this.playbooks.find((playbook) => playbook.segment === 'general') as SalesPlaybookDefinition;
  }

  private scoreCatalogForPlaybook(
    playbook: SalesPlaybookDefinition,
    normalizedProducts: string[],
  ): { score: number; uniqueHits: number; matchedProducts: number } {
    if (playbook.segment === 'general') {
      return { score: 0, uniqueHits: 0, matchedProducts: 0 };
    }

    let score = 0;
    const matchedKeywords = new Set<string>();
    let matchedProducts = 0;

    for (const productDocument of normalizedProducts) {
      let productMatched = false;
      for (const keyword of playbook.keywords) {
        const normalizedKeyword = this.normalize(keyword);
        if (!normalizedKeyword) {
          continue;
        }

        if (productDocument.includes(normalizedKeyword)) {
          score += normalizedKeyword.length >= 6 ? 3 : 2;
          matchedKeywords.add(normalizedKeyword);
          productMatched = true;
        }
      }

      if (productMatched) {
        matchedProducts += 1;
      }
    }

    return {
      score,
      uniqueHits: matchedKeywords.size,
      matchedProducts,
    };
  }

  private buildProductDocument(product: ProductWithStock): string {
    return this.normalize(
      [
        product.name,
        product.description || '',
        product.categoria?.name || '',
        product.sku || '',
        product.unit || '',
      ].join(' '),
    );
  }

  private normalize(value: string): string {
    return this.messageIntelligenceService.normalizeText(value || '');
  }

  private formatCurrency(value: number): string {
    return Number(value || 0).toFixed(2).replace('.', ',');
  }
}
