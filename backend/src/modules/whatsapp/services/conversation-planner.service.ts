import { Injectable } from '@nestjs/common';
import { ConversationalAnalysis } from './conversational-intelligence.service';
import { SalesConversationAnalysis } from './sales-intelligence.service';
import {
  ConversationIntelligenceMemory,
  ConversationResponseMode,
  ConversationState,
} from '../types/whatsapp.types';

type PlannerStateKind = 'active_collection' | 'post_order' | 'idle';

export interface ConversationPlanInput {
  message: string;
  conversationalAnalysis: ConversationalAnalysis;
  salesAnalysis: SalesConversationAnalysis;
  currentState?: ConversationState;
  memory?: ConversationIntelligenceMemory | null;
}

export interface ConversationPlan {
  mode: ConversationResponseMode | 'none';
  confidence: number;
  customerGoal: string;
  lead: string;
  stateKind: PlannerStateKind;
  shouldOverrideTransactional: boolean;
  shouldPreserveFlow: boolean;
  explainWhyCurrentStep: boolean;
  offerSalesBridge: boolean;
}

@Injectable()
export class ConversationPlannerService {
  private readonly questionSignals = [
    'por que',
    'porque',
    'pq',
    'como funciona',
    'como faz',
    'como eu faco',
    'qual e',
    'qual seria',
    'o que voce precisa',
    'o que falta',
    'o que eu mando',
    'o que eu envio',
    'o que acontece agora',
    'precisa disso',
  ];

  private readonly correctionSignals = [
    'faltou',
    'nao era isso',
    'nao e isso',
    'na verdade',
    'entendeu errado',
    'voce entendeu errado',
    'corrige',
    'corrigir',
    'ajusta',
    'ajusta isso',
    'confundiu',
    'ta errado',
    'esta errado',
    'ficou errado',
    'nao ta certo',
    'nao esta certo',
  ];

  private readonly reassuranceSignals = [
    'fica tranquilo',
    'deixa eu ver',
    'so to confirmando',
    'só to confirmando',
    'so queria entender',
    'só queria entender',
    'to meio perdido',
    'to meio perdida',
    'estou meio perdido',
    'estou meio perdida',
  ];

  buildPlan(input: ConversationPlanInput): ConversationPlan {
    const normalized = input.conversationalAnalysis.normalizedText || '';
    const currentState = input.currentState;
    const stateKind = this.getStateKind(currentState);
    const hasQuestionSignal = this.hasAny(normalized, this.questionSignals);
    const hasCorrectionSignal = this.hasAny(normalized, this.correctionSignals);
    const hasReassuranceSignal = this.hasAny(normalized, this.reassuranceSignals);
    const salesBridgeContext =
      input.salesAnalysis.intent !== 'other' ||
      ['recommendation', 'comparison', 'budget', 'objection', 'suggestion'].includes(
        input.memory?.last_intent || '',
      );

    if (stateKind === 'active_collection') {
      if (input.conversationalAnalysis.intent === 'recap') {
        return this.refinePlan(
          this.buildResponse(
            'context_recap',
            'revisar o que eu ja entendi antes de seguir',
            'Claro. Vou te resumir o que ja entendi para a gente alinhar sem perder nada.',
            0.93,
            stateKind,
            true,
            true,
            false,
            false,
          ),
          input,
        );
      }

      if (
        input.conversationalAnalysis.intent === 'handoff'
      ) {
        return this.refinePlan(
          this.buildResponse(
          'handoff_ready',
          'ser atendido sem repetir tudo',
          'Eu consigo te adiantar isso por aqui sem perder o que ja foi montado.',
          0.91,
          stateKind,
          true,
          true,
          true,
          false,
          ),
          input,
        );
      }

      if (
        input.conversationalAnalysis.intent === 'issue' ||
        hasCorrectionSignal
      ) {
        return this.refinePlan(
          this.buildResponse(
          'issue_recovery',
          'corrigir esse ponto sem baguncar o pedido',
          'Sem problema, eu seguro isso com voce sem avancar nada errado.',
          0.9,
          stateKind,
          true,
          true,
          false,
          false,
          ),
          input,
        );
      }

      if (
        input.conversationalAnalysis.intent === 'clarification' ||
        hasQuestionSignal ||
        hasReassuranceSignal
      ) {
        return this.refinePlan(
          this.buildResponse(
          'step_guidance',
          'entender a etapa atual e seguir com seguranca',
          'Eu te explico certinho sem te fazer perder o que ja foi montado.',
          0.88,
          stateKind,
          true,
          true,
          true,
          false,
          ),
          input,
        );
      }
    }

    if (stateKind === 'post_order') {
      if (input.conversationalAnalysis.intent === 'recap') {
        return this.refinePlan(
          this.buildResponse(
          'context_recap',
          'revisar como esse pedido esta agora',
          'Claro. Vou te resumir como esse pedido esta neste momento.',
          0.92,
          stateKind,
          true,
          true,
          false,
          false,
          ),
          input,
        );
      }

      if (input.conversationalAnalysis.intent === 'gratitude') {
        return this.refinePlan(
          this.buildResponse(
          'post_order_support',
          'ter certeza de que o pedido segue na trilha certa',
          'Eu que agradeco.',
          0.86,
          stateKind,
          true,
          true,
          false,
          false,
          ),
          input,
        );
      }

      if (input.conversationalAnalysis.intent === 'handoff') {
        return this.refinePlan(
          this.buildResponse(
          'handoff_ready',
          'ser atendido sem perder o contexto do pedido',
          'Eu consigo adiantar isso por aqui e, se precisar, deixo o contexto pronto para a equipe.',
          0.9,
          stateKind,
          true,
          true,
          false,
          false,
          ),
          input,
        );
      }

      if (
        input.conversationalAnalysis.intent === 'issue' ||
        input.conversationalAnalysis.intent === 'clarification' ||
        hasQuestionSignal ||
        hasCorrectionSignal ||
        hasReassuranceSignal
      ) {
        const customerGoal =
          currentState === 'waiting_payment'
            ? 'resolver o pagamento sem perder o pedido'
            : 'entender ou ajustar algo desse pedido sem mexer errado nele';

        return this.refinePlan(
          this.buildResponse(
          'post_order_support',
          customerGoal,
          'Sem problema, eu te ajudo nisso sem mexer errado no pedido.',
          0.88,
          stateKind,
          true,
          true,
          false,
          false,
          ),
          input,
        );
      }
    }

    if (salesBridgeContext) {
      if (
        input.conversationalAnalysis.intent === 'clarification' ||
        input.conversationalAnalysis.intent === 'hesitation' ||
        input.conversationalAnalysis.intent === 'issue' ||
        input.conversationalAnalysis.posture === 'urgent' ||
        hasQuestionSignal ||
        hasReassuranceSignal
      ) {
        return this.refinePlan(
          this.buildResponse(
          'sales_consultative',
          'afinar a escolha antes de fechar',
          'Sem pressa, eu posso conduzir isso com voce de um jeito mais consultivo.',
          0.82,
          stateKind,
          false,
          false,
          false,
          true,
          ),
          input,
        );
      }
    }

    if (input.conversationalAnalysis.intent === 'recap') {
      return this.refinePlan(
        this.buildResponse(
        'context_recap',
        'revisar o contexto que eu tenho antes de continuar',
        'Claro. Vou te mostrar o que eu tenho entendido ate aqui.',
        0.8,
        stateKind,
        false,
        false,
        false,
        false,
        ),
        input,
      );
    }

    if (input.conversationalAnalysis.intent === 'handoff') {
      return this.refinePlan(
        this.buildResponse(
        'handoff_ready',
        'ser atendido sem repetir tudo do zero',
        'Posso organizar isso com voce por aqui e, se precisar, deixar tudo pronto para atendimento humano.',
        0.82,
        stateKind,
        false,
        false,
        false,
        false,
        ),
        input,
      );
    }

    if (
      input.conversationalAnalysis.intent === 'issue' ||
      input.conversationalAnalysis.intent === 'clarification' ||
      input.conversationalAnalysis.intent === 'hesitation' ||
      hasQuestionSignal ||
      hasCorrectionSignal ||
      hasReassuranceSignal
    ) {
      return this.refinePlan(
        this.buildResponse(
        'freeform_support',
        'explicar melhor o que voce precisa ou o que deu errado',
        'Pode me falar com calma que eu separo isso do jeito certo.',
        0.76,
        stateKind,
        false,
        false,
        false,
        false,
        ),
        input,
      );
    }

    return this.refinePlan(
      this.buildResponse('none', '', '', 0.2, stateKind, false, false, false, false),
      input,
    );
  }

  private getStateKind(currentState?: ConversationState): PlannerStateKind {
    if (
      currentState &&
      [
        'collecting_name',
        'collecting_address',
        'collecting_phone',
        'collecting_notes',
        'collecting_cash_change',
        'confirming_stock_adjustment',
        'confirming_order',
      ].includes(currentState)
    ) {
      return 'active_collection';
    }

    if (
      currentState &&
      ['waiting_payment', 'order_confirmed', 'order_completed'].includes(currentState)
    ) {
      return 'post_order';
    }

    return 'idle';
  }

  private hasAny(normalizedText: string, phrases: string[]): boolean {
    return phrases.some((phrase) => normalizedText.includes(phrase));
  }

  private refinePlan(plan: ConversationPlan, input: ConversationPlanInput): ConversationPlan {
    if (plan.mode === 'none') {
      return plan;
    }

    const posture = input.conversationalAnalysis.posture;
    const refinedLead = this.getRefinedLead(plan, posture);
    const refinedGoal = this.getRefinedGoal(plan, posture);

    return {
      ...plan,
      lead: refinedLead || plan.lead,
      customerGoal: refinedGoal || plan.customerGoal,
    };
  }

  private getRefinedLead(
    plan: ConversationPlan,
    posture: ConversationPlanInput['conversationalAnalysis']['posture'],
  ): string | null {
    switch (plan.mode) {
      case 'step_guidance':
        if (posture === 'reassurance') {
          return 'Vou te conduzir com clareza para voce nao confirmar nada no escuro.';
        }
        if (posture === 'urgent') {
          return 'Vou ser direto e te puxar so para a proxima etapa importante.';
        }
        if (posture === 'confused') {
          return 'Vou te explicar em uma etapa por vez para ficar bem claro.';
        }
        return null;
      case 'issue_recovery':
        return posture === 'frustrated'
          ? 'Calma, eu vou corrigir isso com voce sem perder o que ja foi montado.'
          : null;
      case 'post_order_support':
        if (posture === 'reassurance') {
          return 'Eu vou te orientar com seguranca sem mexer errado no pedido.';
        }
        if (posture === 'frustrated') {
          return 'Eu vou tratar isso com voce sem mexer errado no pedido.';
        }
        return null;
      case 'sales_consultative':
        if (posture === 'hesitant') {
          return 'Sem pressa, eu te ajudo a afinar a escolha sem te empurrar nada.';
        }
        if (posture === 'urgent') {
          return 'Se voce quiser, eu corto caminho com seguranca e te levo direto para a melhor opcao agora.';
        }
        if (posture === 'reassurance') {
          return 'Eu vou te recomendar com criterio, sem te empurrar nada no escuro.';
        }
        return null;
      case 'freeform_support':
        if (posture === 'frustrated') {
          return 'Pode me falar com calma. Eu separo esse problema sem baguncar o resto.';
        }
        if (posture === 'urgent') {
          return 'Me diga em uma frase o ponto principal e eu vou direto no que resolve.';
        }
        if (posture === 'reassurance') {
          return 'Pode falar com calma que eu te respondo com clareza, sem te deixar no escuro.';
        }
        return null;
      default:
        return null;
    }
  }

  private getRefinedGoal(
    plan: ConversationPlan,
    posture: ConversationPlanInput['conversationalAnalysis']['posture'],
  ): string | null {
    switch (plan.mode) {
      case 'step_guidance':
        if (posture === 'reassurance') {
          return 'seguir com seguranca e entender exatamente o que falta';
        }
        if (posture === 'urgent') {
          return 'resolver a proxima etapa sem perder tempo nem errar';
        }
        return null;
      case 'issue_recovery':
        return posture === 'frustrated'
          ? 'corrigir esse ponto sem te fazer repetir tudo'
          : null;
      case 'post_order_support':
        return posture === 'reassurance'
          ? 'ter seguranca sobre o proximo passo desse pedido'
          : null;
      case 'sales_consultative':
        if (posture === 'hesitant') {
          return 'afinar a escolha com calma antes de fechar';
        }
        if (posture === 'urgent') {
          return 'chegar rapido na melhor opcao sem comprar no impulso';
        }
        if (posture === 'reassurance') {
          return 'escolher com seguranca sem medo de errar';
        }
        return null;
      case 'freeform_support':
        return posture === 'frustrated'
          ? 'explicar o problema sem misturar pedido e ruido'
          : null;
      default:
        return null;
    }
  }

  private buildResponse(
    mode: ConversationPlan['mode'],
    customerGoal: string,
    lead: string,
    confidence: number,
    stateKind: PlannerStateKind,
    shouldOverrideTransactional: boolean,
    shouldPreserveFlow: boolean,
    explainWhyCurrentStep: boolean,
    offerSalesBridge: boolean,
  ): ConversationPlan {
    return {
      mode,
      customerGoal,
      lead,
      confidence,
      stateKind,
      shouldOverrideTransactional,
      shouldPreserveFlow,
      explainWhyCurrentStep,
      offerSalesBridge,
    };
  }
}
