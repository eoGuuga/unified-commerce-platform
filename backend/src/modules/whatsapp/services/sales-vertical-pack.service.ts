import { Injectable } from '@nestjs/common';
import { ProductWithStock } from '../../products/types/product.types';
import { SalesConversationAnalysis } from './sales-intelligence.service';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesPlaybookProfile, SalesPlaybookSegment } from './sales-playbook.service';
import { SalesConversationStrategy } from './sales-segment-strategy.service';

export type SalesVerticalPackKey =
  | SalesPlaybookSegment
  | 'pharmacy'
  | 'services';

type SalesVerticalQuestionRule = {
  needs?: string[];
  question: string;
};

type SalesVerticalCrossSellRule = {
  primaryPatterns: string[];
  complementaryPatterns: string[];
  reason: string;
  prompt: string;
};

type SalesVerticalPackDefinition = {
  key: SalesVerticalPackKey;
  label: string;
  salesFrame: string;
  comparisonFrame: string;
  budgetFrame: string;
  objectionFrame: string;
  qualificationQuestions: {
    default: string;
    targeted?: SalesVerticalQuestionRule[];
  };
  closingMoves: {
    default: string;
    budget: string;
    objection: string;
    comparison: string;
  };
  crossSellRules: SalesVerticalCrossSellRule[];
};

export interface SalesVerticalPackProfile extends SalesVerticalPackDefinition {
  confidence: number;
}

export interface SalesVerticalCrossSellSuggestion {
  product: ProductWithStock;
  reason: string;
  prompt: string;
}

@Injectable()
export class SalesVerticalPackService {
  private readonly pharmacyKeywords = [
    'farmacia',
    'analgesico',
    'termometro',
    'pressao',
    'antialergico',
    'higiene',
    'vitamina',
    'dermocosmetico',
  ];

  private readonly servicesKeywords = [
    'servico',
    'servicos',
    'consulta',
    'sessao',
    'pacote',
    'agenda',
    'agendamento',
    'instalacao',
    'manutencao',
    'assistencia',
    'limpeza',
    'revisao',
    'avaliacao',
    'atendimento',
  ];

  private readonly definitions: SalesVerticalPackDefinition[] = [
    {
      key: 'confectionery',
      label: 'confeitaria',
      salesFrame:
        'a venda cresce quando eu amarro ocasiao, apresentacao e impacto emocional logo no primeiro empurrao.',
      comparisonFrame:
        'eu fecho melhor quando deixo claro qual opcao encanta mais, qual compartilha melhor e qual segura o ticket.',
      budgetFrame:
        'mesmo no ajuste de valor, eu tento preservar encanto, visual e sensacao de mimo.',
      objectionFrame:
        'se a pessoa trava no preco, eu recuo o ticket sem matar a sensacao de presente ou indulgencia.',
      qualificationQuestions: {
        default: 'Voce quer isso mais para presente, compartilhar ou matar uma vontade do dia?',
        targeted: [
          {
            needs: ['presente'],
            question: 'Esse presente pede mais impacto visual ou mais quantidade para impressionar?',
          },
          {
            needs: ['evento ou compartilhamento'],
            question: 'Voce quer algo para dividir facil ou para ser o centro da mesa?',
          },
        ],
      },
      closingMoves: {
        default:
          'Se fizer sentido, eu fecho isso do jeito mais bonito para a ocasiao e ja deixo o pedido pronto.',
        budget:
          'Se quiser, eu baixo o ticket sem deixar a compra perder o brilho da ocasiao.',
        objection:
          'Se quiser, eu te mostro a rota mais esperta para manter o encanto sem estourar o bolso.',
        comparison:
          'Se quiser, eu ja fecho a opcao com melhor impacto para a ocasiao que voce descreveu.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['brigadeiro', 'brownie', 'cookie', 'trufa'],
          complementaryPatterns: ['caixa', 'box', 'kit', 'duzia', 'combo'],
          reason: 'eleva a percepcao do presente e organiza melhor a compra',
          prompt: 'Se voce quiser elevar a percepcao da compra, eu ainda combinaria com',
        },
      ],
    },
    {
      key: 'fashion',
      label: 'moda',
      salesFrame:
        'eu vendo melhor quando amarro a peca a uma ocasiao real e faço a cliente visualizar o uso.',
      comparisonFrame:
        'eu comparo pensando em presenca, versatilidade e facilidade de encaixar no look real.',
      budgetFrame:
        'mesmo com limite de valor, eu preservo presenca e versatilidade para nao virar compra sem giro.',
      objectionFrame:
        'quando o preco pesa, eu reencaixo a compra sem derrubar estilo nem seguranca no uso.',
      qualificationQuestions: {
        default: 'Voce quer isso para trabalho, dia a dia, presente ou uma ocasiao especial?',
        targeted: [
          {
            needs: ['uso de trabalho'],
            question: 'No trabalho, voce quer algo mais marcante ou mais versatil para repetir sem cansar?',
          },
          {
            needs: ['noite ou ocasiao especial'],
            question: 'Para essa ocasiao, voce quer mais impacto ou mais conforto para usar por horas?',
          },
        ],
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a peca com melhor giro para a ocasiao e ja adianto a compra por aqui.',
        budget:
          'Se quiser, eu te levo para a versao mais inteligente sem perder presenca no look.',
        objection:
          'Se quiser, eu te mostro onde vale economizar sem desmontar o efeito da compra.',
        comparison:
          'Se quiser, eu ja aponto a peca com melhor giro para esse tipo de uso.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['blazer', 'camisa', 'vestido', 'calca', 'saia'],
          complementaryPatterns: ['bolsa', 'cinto', 'camiseta', 'sapato', 'tenis'],
          reason: 'ajuda a cliente a visualizar o look completo e reduz indecisao',
          prompt: 'Se eu quisesse deixar essa venda ainda mais redonda, eu combinaria com',
        },
      ],
    },
    {
      key: 'beauty',
      label: 'beleza',
      salesFrame:
        'eu vendo melhor quando conecto o item a uma rotina simples e a um resultado que a cliente sente.',
      comparisonFrame:
        'eu comparo pelo encaixe na rotina, sensorial e resultado percebido.',
      budgetFrame:
        'mesmo quando o ticket aperta, eu protejo aderencia a rotina e resultado percebido.',
      objectionFrame:
        'quando o preco trava, eu simplifico a rotina sem prometer milagre nem desmontar o cuidado.',
      qualificationQuestions: {
        default: 'Seu foco e mais rotina diaria, sensorial, pele sensivel, glow ou cuidado capilar?',
        targeted: [
          {
            needs: ['pele sensivel'],
            question: 'Voce quer a rota mais segura para pele sensivel ou algo mais completo para usar aos poucos?',
          },
          {
            needs: ['cuidado capilar'],
            question: 'No cabelo, o foco e mais nutricao, controle de frizz ou reparacao?',
          },
        ],
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a rotina mais inteligente para voce sem deixar a escolha cansativa.',
        budget:
          'Se quiser, eu monto uma rotina mais enxuta sem perder o efeito principal que voce quer.',
        objection:
          'Se quiser, eu mostro a base da rotina que mais entrega sem inflar o ticket.',
        comparison:
          'Se quiser, eu aponto qual encaixa melhor na rotina que voce descreveu.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['serum', 'hidratante', 'base', 'protetor', 'shampoo'],
          complementaryPatterns: ['limpeza', 'protetor', 'hidratante', 'condicionador', 'mascara'],
          reason: 'fecha uma rotina mais coerente e aumenta a chance de recompra',
          prompt: 'Se eu fosse deixar essa escolha mais completa, eu somaria',
        },
      ],
    },
    {
      key: 'optical',
      label: 'otica',
      salesFrame:
        'eu vendo melhor quando deixo claro o contexto de uso e protejo conforto visual.',
      comparisonFrame:
        'eu comparo por protecao, conforto e presenca da armacao para o uso certo.',
      budgetFrame:
        'mesmo reduzindo ticket, eu tento preservar conforto visual e protecao real.',
      objectionFrame:
        'se o preco pesa, eu ajusto sem empurrar uma opcao que comprometa conforto ou seguranca.',
      qualificationQuestions: {
        default: 'Isso e mais para sol, tela, dirigir, uso profissional ou presenca de armacao?',
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a opcao mais segura para esse tipo de uso sem te deixar rodando.',
        budget:
          'Se quiser, eu te mostro onde economizar sem perder o essencial de protecao e conforto.',
        objection:
          'Se quiser, eu te levo para a rota mais segura de custo sem te empurrar uma armacao errada.',
        comparison:
          'Se quiser, eu ja aponto a opcao mais segura para o uso que voce descreveu.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['oculos', 'armacao', 'lente', 'solar'],
          complementaryPatterns: ['estojo', 'limpador', 'lencinho', 'cordao'],
          reason: 'reforca cuidado e conservacao do item',
          prompt: 'Se eu quisesse proteger melhor essa compra, eu ainda somaria',
        },
      ],
    },
    {
      key: 'pharmacy',
      label: 'farmacia',
      salesFrame:
        'eu vendo melhor quando passo seguranca, praticidade e continuidade de cuidado sem exagerar promessa.',
      comparisonFrame:
        'eu comparo olhando uso responsavel, praticidade e aderencia ao cuidado.',
      budgetFrame:
        'mesmo no ajuste de valor, eu preservo seguranca, praticidade e continuidade de uso.',
      objectionFrame:
        'quando o preco pesa, eu simplifico sem transformar o cuidado em algo improvisado.',
      qualificationQuestions: {
        default: 'Voce quer algo mais para rotina, apoio pontual, higiene ou cuidado sensivel?',
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a rota mais pratica e segura para esse tipo de necessidade.',
        budget:
          'Se quiser, eu ajusto para a opcao mais racional sem desmontar o cuidado.',
        objection:
          'Se quiser, eu te mostro a versao mais eficiente para segurar o bolso com responsabilidade.',
        comparison:
          'Se quiser, eu aponto a opcao mais pratica e segura para esse contexto.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['termometro', 'vitamina', 'higiene', 'dermo', 'suplemento'],
          complementaryPatterns: ['higiene', 'protecao', 'organizador', 'vitamina'],
          reason: 'ajuda a sustentar melhor a rotina de cuidado',
          prompt: 'Se eu fosse deixar esse cuidado mais redondo, eu somaria',
        },
      ],
    },
    {
      key: 'wellness',
      label: 'bem-estar',
      salesFrame:
        'eu vendo melhor quando a recomendacao cabe numa rotina real e simples de manter.',
      comparisonFrame:
        'eu comparo olhando constancia, praticidade e encaixe no dia a dia.',
      budgetFrame:
        'mesmo no limite de valor, eu tento proteger constancia e praticidade de uso.',
      objectionFrame:
        'quando o preco trava, eu simplifico a rotina sem deixar a compra sem continuidade.',
      qualificationQuestions: {
        default: 'Seu foco e rotina diaria, energia, cuidado sensivel ou algo mais pontual?',
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a opcao que mais sustenta rotina sem cansar a decisao.',
        budget:
          'Se quiser, eu monto a rota mais enxuta sem desmontar o cuidado recorrente.',
        objection:
          'Se quiser, eu te mostro a base que mais segura resultado com ticket mais leve.',
        comparison:
          'Se quiser, eu aponto a opcao com melhor continuidade para o seu ritmo.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['suplemento', 'proteina', 'vitamina', 'capsula'],
          complementaryPatterns: ['barra', 'coqueteleira', 'higiene', 'proteina'],
          reason: 'deixa a rotina mais pratica e aderente',
          prompt: 'Se eu quisesse facilitar ainda mais essa rotina, eu juntaria',
        },
      ],
    },
    {
      key: 'pet',
      label: 'pet',
      salesFrame:
        'eu vendo melhor quando a recomendacao respeita o perfil do animal e a rotina do tutor.',
      comparisonFrame:
        'eu comparo por porte, fase de vida e praticidade de rotina para o pet.',
      budgetFrame:
        'mesmo ajustando valor, eu preservo aderencia do pet e praticidade para o tutor.',
      objectionFrame:
        'quando o preco pesa, eu reencaixo sem sugerir algo que o pet rejeite ou complique a rotina.',
      qualificationQuestions: {
        default: 'Isso e para cachorro ou gato? E o foco e alimentacao, rotina, higiene ou fase de vida?',
        targeted: [
          {
            needs: ['filhote ou fase inicial'],
            question: 'Como e a fase do pet hoje: adaptacao, recompensa ou rotina de alimentacao?',
          },
        ],
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a opcao mais aderente para o perfil do pet sem te fazer perder tempo.',
        budget:
          'Se quiser, eu ajusto para a rota mais esperta sem comprometer a rotina do pet.',
        objection:
          'Se quiser, eu mostro onde faz sentido economizar sem perder aderencia do pet.',
        comparison:
          'Se quiser, eu aponto a opcao com melhor aderencia para esse perfil de animal.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['racao', 'petisco', 'snack', 'coleira'],
          complementaryPatterns: ['petisco', 'higiene', 'brinquedo', 'sache'],
          reason: 'reforca a rotina do pet e aumenta praticidade para o tutor',
          prompt: 'Se eu quisesse deixar essa compra mais completa para a rotina do pet, eu ainda levaria',
        },
      ],
    },
    {
      key: 'restaurant',
      label: 'alimentacao',
      salesFrame:
        'eu vendo melhor quando resolvo fome, momento de consumo e ticket de um jeito rapido.',
      comparisonFrame:
        'eu comparo por saciedade, velocidade de decisao e composicao do pedido.',
      budgetFrame:
        'mesmo ajustando o ticket, eu tento preservar saciedade e sensacao de refeicao completa.',
      objectionFrame:
        'quando o preco trava, eu recuo sem desmontar a refeicao nem deixar a compra capenga.',
      qualificationQuestions: {
        default: 'Isso e mais para almoco, jantar, lanche rapido ou para dividir com mais gente?',
        targeted: [
          {
            needs: ['almoco ou refeicao principal'],
            question: 'Para esse almoco, voce quer algo mais completo ou mais leve no ticket?',
          },
          {
            needs: ['dividir ou compartilhar'],
            question: 'Para dividir, o foco e mais quantidade ou algo com melhor percepcao de valor?',
          },
        ],
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a combinacao com melhor satisfacao para esse momento.',
        budget:
          'Se quiser, eu ajusto o ticket sem deixar a refeicao perder forca.',
        objection:
          'Se quiser, eu te mostro a rota mais inteligente para manter a fome resolvida sem exagerar no valor.',
        comparison:
          'Se quiser, eu ja aponto a combinacao com melhor fechamento para esse contexto.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['lanche', 'hamburguer', 'pizza', 'marmita', 'combo', 'prato'],
          complementaryPatterns: ['suco', 'refrigerante', 'bebida', 'sobremesa', 'porcao'],
          reason: 'aumenta percepcao de refeicao completa e sobe ticket com naturalidade',
          prompt: 'Se eu fosse deixar esse pedido mais redondo, eu ainda somaria',
        },
      ],
    },
    {
      key: 'electronics',
      label: 'eletronicos',
      salesFrame:
        'eu vendo melhor quando amarro compatibilidade, uso real e argumento tecnico sem enrolar.',
      comparisonFrame:
        'eu comparo por compatibilidade, praticidade e ganho tecnico no uso descrito.',
      budgetFrame:
        'mesmo ajustando o valor, eu tento preservar compatibilidade e desempenho util.',
      objectionFrame:
        'quando o preco pesa, eu recuo sem deixar o cliente levar algo incompatível ou fraco.',
      qualificationQuestions: {
        default: 'Isso e para iphone, android, notebook, trabalho, bateria ou uso do dia a dia?',
        targeted: [
          {
            needs: ['compatibilidade com iphone'],
            question: 'No iPhone, o foco e mais compatibilidade segura, velocidade ou praticidade no uso diario?',
          },
          {
            needs: ['compatibilidade com android'],
            question: 'No Android, o foco e mais potencia, compatibilidade ou praticidade para levar?',
          },
        ],
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a opcao com melhor encaixe tecnico para o uso que voce descreveu.',
        budget:
          'Se quiser, eu te mostro onde economizar sem correr risco de incompatibilidade.',
        objection:
          'Se quiser, eu aponto a rota mais segura para reduzir ticket sem comprar errado.',
        comparison:
          'Se quiser, eu ja aponto a opcao com melhor compatibilidade para esse caso.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['celular', 'fone', 'carregador', 'cabo', 'notebook'],
          complementaryPatterns: ['cabo', 'carregador', 'case', 'pelicula', 'memoria'],
          reason: 'protege a compra principal ou melhora o uso no dia a dia',
          prompt: 'Se eu quisesse deixar essa compra mais completa, eu ainda combinaria com',
        },
      ],
    },
    {
      key: 'home',
      label: 'casa',
      salesFrame:
        'eu vendo melhor quando amarro a compra ao ambiente real e ao problema pratico que ela resolve.',
      comparisonFrame:
        'eu comparo por espaco, presenca visual e praticidade no ambiente.',
      budgetFrame:
        'mesmo com limite de valor, eu tento preservar utilidade e presenca no ambiente.',
      objectionFrame:
        'quando o preco pesa, eu reencaixo sem transformar a compra em algo sem impacto nem uso.',
      qualificationQuestions: {
        default: 'Isso e mais para organizar, decorar, otimizar espaco ou resolver alguma rotina da casa?',
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a opcao com melhor efeito pratico para esse ambiente.',
        budget:
          'Se quiser, eu te mostro a rota mais inteligente para preservar uso e presenca.',
        objection:
          'Se quiser, eu aponto onde vale economizar sem matar a utilidade ou o visual.',
        comparison:
          'Se quiser, eu ja aponto a opcao com melhor impacto para esse ambiente.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['organizador', 'almofada', 'lampada', 'mesa', 'cadeira'],
          complementaryPatterns: ['decor', 'organizador', 'lampada', 'multiuso'],
          reason: 'ajuda a fechar um ambiente mais coerente e util',
          prompt: 'Se eu quisesse deixar esse ambiente mais bem resolvido, eu ainda somaria',
        },
      ],
    },
    {
      key: 'services',
      label: 'servicos',
      salesFrame:
        'eu vendo melhor quando descubro urgencia, escopo e janela de atendimento antes de fechar proposta.',
      comparisonFrame:
        'eu comparo por prazo, profundidade da entrega e facilidade de virar agendamento.',
      budgetFrame:
        'mesmo no ajuste de valor, eu tento preservar clareza de escopo e seguranca para fechar.',
      objectionFrame:
        'quando o preco pesa, eu reencaixo escopo sem criar expectativa errada sobre o que sera entregue.',
      qualificationQuestions: {
        default: 'Voce quer resolver isso com urgencia, agendar uma avaliacao ou montar um pacote mais completo?',
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho pela rota mais facil: avaliacao, pacote ou agendamento direto.',
        budget:
          'Se quiser, eu reencaixo o escopo para uma entrada mais leve sem prometer alem do combinado.',
        objection:
          'Se quiser, eu te mostro a menor estrutura que ainda resolve de forma profissional.',
        comparison:
          'Se quiser, eu aponto a rota com melhor equilibrio entre prazo, profundidade e fechamento.',
      },
      crossSellRules: [
        {
          primaryPatterns: ['consulta', 'sessao', 'pacote', 'manutencao', 'instalacao', 'limpeza'],
          complementaryPatterns: ['retorno', 'visita', 'avaliacao', 'plano', 'pacote'],
          reason: 'deixa a entrega mais previsivel e aumenta a sensacao de acompanhamento',
          prompt: 'Se eu quisesse deixar esse fechamento mais profissional, eu ainda combinaria com',
        },
      ],
    },
    {
      key: 'general',
      label: 'varejo',
      salesFrame:
        'eu vendo melhor quando descubro uso, valor percebido e o proximo passo mais simples.',
      comparisonFrame:
        'eu comparo por adequacao ao uso, praticidade e chance de fechar sem atrito.',
      budgetFrame:
        'mesmo ajustando o ticket, eu tento preservar adequacao ao uso e valor percebido.',
      objectionFrame:
        'quando o preco pesa, eu reencaixo a compra sem empurrar algo que nao faca sentido.',
      qualificationQuestions: {
        default: 'Se quiser, me diga o uso principal, a faixa de valor ou para quem e a compra.',
      },
      closingMoves: {
        default:
          'Se quiser, eu fecho a rota mais segura para transformar isso em pedido sem atrito.',
        budget:
          'Se quiser, eu ajusto para a faixa mais inteligente sem perder o essencial.',
        objection:
          'Se quiser, eu te mostro a rota mais racional para baixar o ticket sem comprar errado.',
        comparison:
          'Se quiser, eu ja aponto qual fecha melhor para o contexto que voce trouxe.',
      },
      crossSellRules: [],
    },
  ];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  buildPack(
    playbook: SalesPlaybookProfile,
    products: ProductWithStock[],
  ): SalesVerticalPackProfile {
    const documents = products.map((product) => this.buildProductDocument(product));
    const baseKey = this.inferPackKey(playbook, documents);
    const definition = this.getDefinition(baseKey);

    return {
      ...definition,
      confidence: baseKey === playbook.segment ? 0.88 : 0.73,
    };
  }

  buildQualificationQuestion(
    pack: SalesVerticalPackProfile,
    strategy: SalesConversationStrategy,
  ): string {
    const detectedLabels = new Set(strategy.detectedNeeds.map((need) => need.label));
    const targeted = (pack.qualificationQuestions.targeted || []).find((rule) =>
      (rule.needs || []).some((need) => detectedLabels.has(need)),
    );

    return targeted?.question || pack.qualificationQuestions.default;
  }

  buildClosingMove(
    pack: SalesVerticalPackProfile,
    analysis: SalesConversationAnalysis,
  ): string {
    if (analysis.intent === 'budget') {
      return pack.closingMoves.budget;
    }

    if (analysis.intent === 'objection') {
      return pack.closingMoves.objection;
    }

    if (analysis.intent === 'comparison') {
      return pack.closingMoves.comparison;
    }

    return pack.closingMoves.default;
  }

  findCrossSellSuggestion(
    pack: SalesVerticalPackProfile,
    products: ProductWithStock[],
    rankedProducts: ProductWithStock[],
  ): SalesVerticalCrossSellSuggestion | null {
    if (!rankedProducts.length || !pack.crossSellRules.length) {
      return null;
    }

    const rankedIds = new Set(rankedProducts.map((product) => product.id));

    for (const primary of rankedProducts) {
      const primaryDocument = this.buildProductDocument(primary);

      for (const rule of pack.crossSellRules) {
        const matchesPrimary = rule.primaryPatterns.some((pattern) =>
          primaryDocument.includes(this.normalize(pattern)),
        );

        if (!matchesPrimary) {
          continue;
        }

        const candidate = products.find((product) => {
          if (rankedIds.has(product.id) || Number(product.available_stock || 0) <= 0) {
            return false;
          }

          const document = this.buildProductDocument(product);
          return rule.complementaryPatterns.some((pattern) =>
            document.includes(this.normalize(pattern)),
          );
        });

        if (candidate) {
          return {
            product: candidate,
            reason: rule.reason,
            prompt: rule.prompt,
          };
        }
      }
    }

    return null;
  }

  private inferPackKey(
    playbook: SalesPlaybookProfile,
    productDocuments: string[],
  ): SalesVerticalPackKey {
    const catalogText = productDocuments.join(' ');
    const pharmacyScore = this.countKeywordHits(catalogText, this.pharmacyKeywords);
    const servicesScore = this.countKeywordHits(catalogText, this.servicesKeywords);

    if (servicesScore >= 3 && servicesScore > pharmacyScore + 1) {
      return 'services';
    }

    if (
      pharmacyScore >= 3 &&
      (playbook.segment === 'wellness' || playbook.segment === 'general')
    ) {
      return 'pharmacy';
    }

    return playbook.segment;
  }

  private getDefinition(key: SalesVerticalPackKey): SalesVerticalPackDefinition {
    return (
      this.definitions.find((definition) => definition.key === key) ||
      this.definitions.find((definition) => definition.key === 'general')
    ) as SalesVerticalPackDefinition;
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

  private countKeywordHits(document: string, keywords: string[]): number {
    return keywords.reduce((total, keyword) => {
      return total + (document.includes(this.normalize(keyword)) ? 1 : 0);
    }, 0);
  }

  private normalize(value: string): string {
    return this.messageIntelligenceService.normalizeText(value || '');
  }
}
