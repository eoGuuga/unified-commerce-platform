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

export interface ConversationalAnalysis {
  normalizedText: string;
  intent: ConversationalIntent;
  confidence: number;
  signals: {
    clarification: boolean;
    issue: boolean;
    recap: boolean;
    handoff: boolean;
    gratitude: boolean;
    hesitation: boolean;
    frustration: boolean;
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

  private readonly frustrationPhrases = [
    'nao ta certo',
    'nao esta certo',
    'ta estranho',
    'estranho isso',
    'ta confuso',
    'me perdi',
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
    const frustration = this.hasAny(normalizedText, this.frustrationPhrases);

    let intent: ConversationalIntent = 'other';
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
    } else if (clarification || frustration) {
      intent = 'clarification';
      confidence = clarification ? 0.82 : 0.74;
    } else if (hesitation) {
      intent = 'hesitation';
      confidence = 0.76;
    } else if (gratitude) {
      intent = 'gratitude';
      confidence = 0.78;
    }

    return {
      normalizedText,
      intent,
      confidence,
      signals: {
        clarification,
        issue,
        recap,
        handoff,
        gratitude,
        hesitation,
        frustration,
      },
    };
  }

  private hasAny(normalizedText: string, phrases: string[]): boolean {
    return phrases.some((phrase) =>
      normalizedText.includes(this.messageIntelligenceService.normalizeText(phrase)),
    );
  }
}
