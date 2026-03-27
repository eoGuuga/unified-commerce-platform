import { Injectable } from '@nestjs/common';
import { MessageIntelligenceService } from './message-intelligence.service';

export type ConversationalIntent =
  | 'clarification'
  | 'issue'
  | 'recap'
  | 'handoff'
  | 'gratitude'
  | 'hesitation'
  | 'other';

export type ConversationalPosture =
  | 'confused'
  | 'frustrated'
  | 'reassurance'
  | 'hesitant'
  | 'urgent'
  | 'calm';

export type ConversationalTopic =
  | 'payment'
  | 'delivery'
  | 'catalog'
  | 'order'
  | 'human_support'
  | 'general';

export interface ConversationalAnalysis {
  normalizedText: string;
  intent: ConversationalIntent;
  secondaryIntents: ConversationalIntent[];
  topic: ConversationalTopic;
  customerNeeds: string[];
  posture: ConversationalPosture;
  confidence: number;
  signals: {
    clarification: boolean;
    issue: boolean;
    recap: boolean;
    handoff: boolean;
    gratitude: boolean;
    hesitation: boolean;
    correction: boolean;
    decisionHelp: boolean;
    trust: boolean;
    frustration: boolean;
    reassurance: boolean;
    urgency: boolean;
  };
  responseStyle: {
    empathy: boolean;
    reassurance: boolean;
    directness: boolean;
    stepByStep: boolean;
  };
}

@Injectable()
export class ConversationalIntelligenceService {
  private readonly clarificationPhrases = [
    'nao entendi',
    'nao entendeu',
    'voce nao entendeu',
    'voce nao esta entendendo',
    'como assim',
    'explica melhor',
    'me explica',
    'explica',
    'me ajuda',
    'ajuda aqui',
    'me orienta',
    'o que voce precisa',
    'o que voce quer dizer',
    'nao era isso',
    'nao foi isso',
    'deixa eu explicar',
    'calma',
    'pera ai',
    'pera',
    'como funciona',
  ];

  private readonly issuePhrases = [
    'deu erro',
    'deu ruim',
    'bugou',
    'travou',
    'nao funcionou',
    'nao esta funcionando',
    'ta com problema',
    'esta com problema',
    'to com problema',
    'estou com problema',
    'nao respondeu',
    'pagamento nao foi',
    'pix nao caiu',
    'pix nao gerou',
    'nao gerou pix',
    'nao apareceu',
    'nao abriu',
    'nao deu certo',
    'ta errado',
    'esta errado',
  ];

  private readonly correctionPhrases = [
    'entendeu errado',
    'voce entendeu errado',
    'nao era isso',
    'nao e isso',
    'na verdade',
    'deixa eu corrigir',
    'vou corrigir',
    'corrige',
    'corrigir',
    'ajusta',
    'ajusta isso',
    'nao foi isso',
    'faltou',
    'confundiu',
    'ficou errado',
  ];

  private readonly handoffPhrases = [
    'falar com alguem',
    'falar com uma pessoa',
    'falar com atendente',
    'quero atendimento humano',
    'quero falar com humano',
    'quero falar com pessoa',
    'tem alguem ai',
    'suporte humano',
    'atendente',
    'humano',
    'vendedor',
    'suporte',
  ];

  private readonly recapPhrases = [
    'o que voce entendeu',
    'o que vc entendeu',
    'o que voce ja entendeu',
    'me resume',
    'resume pra mim',
    'resume ai',
    'repete meu pedido',
    'me mostra como ficou',
    'como ficou meu pedido',
    'me fala como ficou',
    'o que voce anotou',
    'o que ja ficou salvo',
    'me relembra',
  ];

  private readonly gratitudePhrases = [
    'obrigado',
    'obrigada',
    'obg',
    'valeu',
    'brigadao',
    'brigada',
    'show',
    'fechou',
    'perfeito',
    'top',
  ];

  private readonly hesitationPhrases = [
    'to pensando',
    'estou pensando',
    'vou pensar',
    'depois eu vejo',
    'so queria entender',
    'só queria entender',
    'to vendo ainda',
    'nao sei ainda',
    'estou vendo ainda',
  ];

  private readonly decisionHelpPhrases = [
    'o que voce acha',
    'qual voce acha melhor',
    'me ajuda a escolher',
    'me ajuda a decidir',
    'nao sei qual escolher',
    'qual faz mais sentido',
    'qual compensa mais para mim',
    'qual vale mais a pena para mim',
    'to em duvida',
    'estou em duvida',
    'em duvida ainda',
  ];

  private readonly reassurancePhrases = [
    'tem certeza',
    'vai dar certo',
    'da certo',
    'pode confiar',
    'confiavel',
    'confiavel mesmo',
    'nao quero errar',
    'nao posso errar',
    'quero fazer certo',
    'sem erro',
    'quero ter certeza',
    'me confirma',
    'garante',
    'ta seguro',
    'esta seguro',
  ];

  private readonly paymentTopicPhrases = [
    'pix',
    'pagamento',
    'pagar',
    'comprovante',
    'cobranca',
    'cobrar',
    'paguei',
    'ja paguei',
  ];

  private readonly deliveryTopicPhrases = [
    'entrega',
    'retirada',
    'retirar',
    'endereco',
    'rua',
    'bairro',
    'cep',
    'motoboy',
    'entregador',
  ];

  private readonly catalogTopicPhrases = [
    'cardapio',
    'catalogo',
    'menu',
    'produto',
    'produtos',
    'item',
    'itens',
    'opcao',
    'opcoes',
  ];

  private readonly orderTopicPhrases = [
    'pedido',
    'encomenda',
    'status',
    'acompanhar',
    'codigo',
    'order',
    'rastrear',
  ];

  private readonly urgencyPhrases = [
    'agora',
    'urgente',
    'rapidinho',
    'rapido',
    'o mais rapido possivel',
    'quanto antes',
    'pra hoje',
    'para hoje',
    'to com pressa',
    'estou com pressa',
    'correndo',
  ];

  private readonly frustrationPhrases = [
    'nao ta certo',
    'nao esta certo',
    'ta estranho',
    'estranho isso',
    'ta confuso',
    'me perdi',
    'to irritado',
    'estou irritado',
    'to irritada',
    'estou irritada',
    'to chateado',
    'estou chateado',
    'to chateada',
    'estou chateada',
    'to frustrado',
    'estou frustrado',
    'to frustrada',
    'estou frustrada',
    'sacanagem',
    'meu deus',
    'mds',
    'tira isso',
    'para com isso',
    'que isso',
    'pelo amor de deus',
    'credo',
    'aff',
    'affs',
    'oxe',
    'eita',
  ];

  constructor(private readonly messageIntelligenceService: MessageIntelligenceService) {}

  analyze(message: string): ConversationalAnalysis {
    const normalizedText = this.messageIntelligenceService.normalizeText(message || '');

    const clarification = this.hasAny(normalizedText, this.clarificationPhrases);
    const issue = this.hasAny(normalizedText, this.issuePhrases);
    const recap = this.hasAny(normalizedText, this.recapPhrases);
    const handoff = this.hasAny(normalizedText, this.handoffPhrases);
    const gratitude = this.hasAny(normalizedText, this.gratitudePhrases);
    const hesitation = this.hasAny(normalizedText, this.hesitationPhrases);
    const correction = this.hasAny(normalizedText, this.correctionPhrases);
    const decisionHelp = this.hasAny(normalizedText, this.decisionHelpPhrases);
    const frustration = this.hasAny(normalizedText, this.frustrationPhrases);
    const reassurance = this.hasAny(normalizedText, this.reassurancePhrases);
    const urgency = this.hasAny(normalizedText, this.urgencyPhrases);
    const trust = reassurance;
    const paymentTopic = this.hasAny(normalizedText, this.paymentTopicPhrases);
    const deliveryTopic = this.hasAny(normalizedText, this.deliveryTopicPhrases);
    const catalogTopic = this.hasAny(normalizedText, this.catalogTopicPhrases);
    const orderTopic = recap || this.hasAny(normalizedText, this.orderTopicPhrases);

    let intent: ConversationalIntent = 'other';
    let posture: ConversationalPosture = 'calm';
    let topic: ConversationalTopic = 'general';
    let confidence = 0.2;

    if (handoff) {
      intent = 'handoff';
      confidence = 0.88;
    } else if (recap) {
      intent = 'recap';
      confidence = 0.86;
    } else if (issue) {
      intent = 'issue';
      confidence = 0.84;
    } else if (clarification || correction || frustration) {
      intent = 'clarification';
      confidence = clarification || correction ? 0.82 : 0.74;
    } else if (hesitation || decisionHelp) {
      intent = 'hesitation';
      confidence = decisionHelp ? 0.79 : 0.76;
    } else if (gratitude) {
      intent = 'gratitude';
      confidence = 0.78;
    }

    if (issue || frustration) {
      posture = 'frustrated';
    } else if (trust) {
      posture = 'reassurance';
    } else if (clarification || correction) {
      posture = 'confused';
    } else if (hesitation || decisionHelp) {
      posture = 'hesitant';
    } else if (urgency) {
      posture = 'urgent';
    }

    if (paymentTopic) {
      topic = 'payment';
    } else if (deliveryTopic) {
      topic = 'delivery';
    } else if (catalogTopic) {
      topic = 'catalog';
    } else if (handoff) {
      topic = 'human_support';
    } else if (orderTopic) {
      topic = 'order';
    }

    const secondaryIntents = this.collectSecondaryIntents({
      primaryIntent: intent,
      recap,
      handoff,
      issue,
      clarification,
      gratitude,
      hesitation,
      correction,
      decisionHelp,
    });
    const customerNeeds = this.buildCustomerNeeds({
      intent,
      topic,
      recap,
      handoff,
      issue,
      clarification,
      hesitation,
      correction,
      decisionHelp,
      frustration,
      reassurance,
      urgency,
    });

    return {
      normalizedText,
      intent,
      secondaryIntents,
      topic,
      customerNeeds,
      posture,
      confidence,
      signals: {
        clarification,
        issue,
        recap,
        handoff,
        gratitude,
        hesitation,
        correction,
        decisionHelp,
        trust,
        frustration,
        reassurance,
        urgency,
      },
      responseStyle: {
        empathy: posture === 'frustrated',
        reassurance: posture === 'reassurance' || trust,
        directness: posture === 'urgent',
        stepByStep: posture === 'confused' || clarification || correction,
      },
    };
  }

  private collectSecondaryIntents(flags: {
    primaryIntent: ConversationalIntent;
    recap: boolean;
    handoff: boolean;
    issue: boolean;
    clarification: boolean;
    gratitude: boolean;
    hesitation: boolean;
    correction: boolean;
    decisionHelp: boolean;
  }): ConversationalIntent[] {
    const candidates: Array<{ intent: ConversationalIntent; active: boolean }> = [
      { intent: 'handoff', active: flags.handoff },
      { intent: 'recap', active: flags.recap },
      { intent: 'issue', active: flags.issue },
      { intent: 'clarification', active: flags.clarification || flags.correction },
      { intent: 'hesitation', active: flags.hesitation || flags.decisionHelp },
      { intent: 'gratitude', active: flags.gratitude },
    ];

    return candidates
      .filter((candidate) => candidate.active && candidate.intent !== flags.primaryIntent)
      .map((candidate) => candidate.intent)
      .slice(0, 2);
  }

  private buildCustomerNeeds(flags: {
    intent: ConversationalIntent;
    topic: ConversationalTopic;
    recap: boolean;
    handoff: boolean;
    issue: boolean;
    clarification: boolean;
    hesitation: boolean;
    correction: boolean;
    decisionHelp: boolean;
    frustration: boolean;
    reassurance: boolean;
    urgency: boolean;
  }): string[] {
    const needs = new Set<string>();

    if (flags.recap) {
      needs.add(
        flags.topic === 'order'
          ? 'revisar como o pedido esta agora'
          : 'revisar o que eu ja entendi antes de seguir',
      );
    }

    if (flags.handoff) {
      needs.add('nao repetir tudo para falar com alguem');
    }

    if (flags.issue || flags.correction || flags.frustration) {
      needs.add(
        flags.topic === 'payment'
          ? 'resolver o pagamento sem criar mais confusao'
          : 'corrigir esse ponto sem baguncar o que ja foi feito',
      );
    }

    if (flags.clarification) {
      needs.add('entender melhor o que esta acontecendo agora');
    }

    if (flags.hesitation || flags.decisionHelp) {
      needs.add('ter ajuda para decidir com calma');
    }

    if (flags.reassurance) {
      needs.add(
        flags.topic === 'payment'
          ? 'ter seguranca antes de pagar ou confirmar'
          : 'seguir com seguranca sem errar',
      );
    }

    if (flags.urgency) {
      needs.add('resolver isso rapido sem pular o que e critico');
    }

    if (!needs.size) {
      needs.add('ter uma resposta clara para seguir');
    }

    return Array.from(needs).slice(0, 3);
  }

  private hasAny(normalizedText: string, phrases: string[]): boolean {
    return phrases.some((phrase) =>
      normalizedText.includes(this.messageIntelligenceService.normalizeText(phrase)),
    );
  }
}
