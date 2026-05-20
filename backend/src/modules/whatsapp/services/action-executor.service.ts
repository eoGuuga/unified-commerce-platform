import { Injectable, Logger } from '@nestjs/common';
import { RouterDecision } from './llm-router.service';
import { BotConfig } from './bot-config.service';
import { OpenAIService } from './openai.service';
import { TypedConversation } from '../types/whatsapp.types';

export interface ExecutionContext {
  tenantId: string;
  conversation?: TypedConversation;
  botConfig: BotConfig;
  message: string;
  customerName?: string | null;
}

export interface ExecutionResult {
  response: string;
  stateTransition?: string | null;
}

@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);

  constructor(private readonly openAIService: OpenAIService) {}

  async execute(
    decision: RouterDecision,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const result = await this.dispatch(decision, context);
      const latencyMs = Date.now() - startTime;
      this.logger.log('Action executed', {
        action: decision.action,
        latencyMs,
        hasStateTransition: !!result.stateTransition,
      });
      return result;
    } catch (error) {
      this.logger.error('Action execution failed', {
        action: decision.action,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        response: 'Desculpe, tive um problema ao processar sua mensagem. Pode repetir?',
      };
    }
  }

  private async dispatch(
    decision: RouterDecision,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    switch (decision.action) {
      case 'greeting':
        return this.handleGreeting(context);
      case 'farewell':
        return this.handleFarewell(context);
      case 'answer_question':
        return this.handleAnswerQuestion(decision, context);
      case 'clarify':
        return this.handleClarify(decision, context);
      case 'handoff_human':
        return this.handleHandoff(decision, context);
      case 'show_catalog':
      case 'process_order':
      case 'check_price':
      case 'check_stock':
      case 'check_order_status':
      case 'cancel_order':
      case 'select_payment':
      case 'collect_info':
        return { response: '', stateTransition: decision.action };
      default:
        return this.handleClarify(
          { action: 'clarify', params: { reason: 'unknown_action' }, confidence: 0 },
          context,
        );
    }
  }

  private async handleGreeting(context: ExecutionContext): Promise<ExecutionResult> {
    const { botConfig, customerName } = context;
    const prompt = this.buildConversationalPrompt(
      botConfig,
      `Gere uma saudacao curta e acolhedora como ${botConfig.persona.name}. ` +
        (customerName ? `O cliente se chama ${customerName}. ` : '') +
        `Tom: ${botConfig.persona.tone}. Maximo 2 linhas.`,
    );

    const reply = await this.generateConversationalReply(prompt, botConfig);
    return { response: reply };
  }

  private async handleFarewell(context: ExecutionContext): Promise<ExecutionResult> {
    const { botConfig, customerName } = context;
    const prompt = this.buildConversationalPrompt(
      botConfig,
      `Gere uma despedida curta e calorosa como ${botConfig.persona.name}. ` +
        (customerName ? `O cliente se chama ${customerName}. ` : '') +
        `Tom: ${botConfig.persona.tone}. Maximo 2 linhas. Convide a voltar.`,
    );

    const reply = await this.generateConversationalReply(prompt, botConfig);
    return { response: reply };
  }

  private async handleAnswerQuestion(
    decision: RouterDecision,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const { botConfig, message } = context;
    const topic = decision.params?.topic || 'pergunta geral';

    const prompt = this.buildConversationalPrompt(
      botConfig,
      [
        `O cliente perguntou sobre: "${topic}".`,
        `Mensagem original: "${message}"`,
        '',
        `Responda como ${botConfig.persona.name} (${botConfig.persona.role}).`,
        `Informacoes da loja:`,
        `- Horario: ${botConfig.store.business_hours}`,
        `- Pagamento: ${botConfig.store.payment_methods.join(', ')}`,
        `- Entrega: ${botConfig.store.delivery_options.join(', ')}`,
        '',
        'Regras:',
        ...botConfig.rules.map((r) => `- ${r}`),
        '',
        'Responda em no maximo 3 linhas. Se nao souber, diga que vai verificar.',
      ].join('\n'),
    );

    const reply = await this.generateConversationalReply(prompt, botConfig);
    return { response: reply };
  }

  private async handleClarify(
    decision: RouterDecision,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const { botConfig, message } = context;
    const reason = decision.params?.reason || 'mensagem ambigua';

    const prompt = this.buildConversationalPrompt(
      botConfig,
      [
        `A mensagem do cliente foi ambigua ou nao ficou clara.`,
        `Mensagem: "${message}"`,
        `Motivo da ambiguidade: ${reason}`,
        '',
        `Peca esclarecimento de forma natural e acolhedora como ${botConfig.persona.name}.`,
        `Sugira opcoes se possivel (ex: "Voce gostaria de ver o cardapio ou fazer um pedido?").`,
        'Maximo 2 linhas.',
      ].join('\n'),
    );

    const reply = await this.generateConversationalReply(prompt, botConfig);
    return { response: reply };
  }

  private async handleHandoff(
    decision: RouterDecision,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    const { botConfig } = context;
    const reason = decision.params?.reason || 'solicitacao do cliente';

    const prompt = this.buildConversationalPrompt(
      botConfig,
      [
        `O cliente precisa de atendimento humano.`,
        `Motivo: ${reason}`,
        '',
        `Informe que vai encaminhar para um atendente. Seja empático.`,
        'Maximo 2 linhas.',
      ].join('\n'),
    );

    const reply = await this.generateConversationalReply(prompt, botConfig);
    return { response: reply, stateTransition: 'handoff_human' };
  }

  private buildConversationalPrompt(botConfig: BotConfig, instruction: string): string {
    return [
      `Voce e ${botConfig.persona.name}, ${botConfig.persona.role} da ${botConfig.store.name}.`,
      `${botConfig.store.description}.`,
      `Tom: ${botConfig.persona.tone}.`,
      '',
      instruction,
      '',
      'IMPORTANTE: Responda SOMENTE o texto da mensagem, sem JSON, sem prefixos, sem aspas.',
      'Nao use markdown. Nao use emojis em excesso (maximo 1-2 por mensagem).',
    ].join('\n');
  }

  private async generateConversationalReply(
    systemPrompt: string,
    botConfig: BotConfig,
  ): Promise<string> {
    const reply = await this.openAIService.generateTextReply(
      systemPrompt,
      botConfig.model,
      botConfig.temperature + 0.2,
    );

    return reply || 'Oi! Como posso ajudar?';
  }
}
