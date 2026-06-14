import { Injectable, Logger } from '@nestjs/common';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
}

export interface ErrorContext {
  tenantId?: string;
  customerPhone?: string;
  messageId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface FallbackResponse {
  message: string;
  shouldRetry: boolean;
  retryAfterMs?: number;
  escalate?: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  exponentialBase: 2,
};

const ERROR_MESSAGES = {
  // Erros de conexão
  CONNECTION_REFUSED: 'Nosso sistema está passando por manutenção. Tente novamente em alguns minutos.',
  CONNECTION_TIMEOUT: 'A conexão está lenta. Por favor, tente novamente.',
  NETWORK_ERROR: 'Parece que há um problema de conexão. Verifique sua internet e tente novamente.',

  // Erros de validação
  INVALID_INPUT: 'Não entendi muito bem. Pode reformular sua mensagem?',
  MISSING_REQUIRED_FIELD: 'Preciso de mais informações para continuar. Pode me ajudar?',
  INVALID_QUANTITY: 'A quantidade informada não é válida. Use apenas números.',
  INVALID_PHONE: 'O número de telefone não parece válido. Pode verificar?',

  // Erros de negócio
  OUT_OF_STOCK: 'Desculpe, este produto está fora de estoque no momento.',
  PRICE_CHANGED: 'O preço deste produto foi atualizado. Posso mostrar o novo valor?',
  ORDER_NOT_FOUND: 'Não consegui encontrar este pedido. Pode verificar o número?',
  PAYMENT_FAILED: 'O pagamento não foi processado. Por favor, tente novamente ou escolha outra forma de pagamento.',
  COUPON_INVALID: 'Este cupom não é válido ou expirou.',
  COUPON_EXPIRED: 'Este cupom expirou.',
  COUPON_ALREADY_USED: 'Este cupom já foi utilizado.',

  // Erros de carrinho
  CART_EXPIRED: 'Seu carrinho expirou. Deixe-me criar um novo para você!',
  CART_EMPTY: 'Seu carrinho está vazio. Que tal adicionar alguns produtos?',
  CART_LIMIT_REACHED: 'Você atingiu o limite máximo de itens no carrinho.',

  // Erros genéricos
  UNKNOWN_ERROR: 'Ops! Algo deu errado. Pode repetir sua mensagem?',
  RATE_LIMIT_EXCEEDED: ' muitas mensagens em pouco tempo. Aguarde um momento.',
  SERVICE_UNAVAILABLE: 'Nosso sistema está temporariamente indisponível. Tente novamente mais tarde.',

  // Erros de IA
  AI_TIMEOUT: 'Estou demorando para processar sua solicitação. Um momento...',
  AI_ERROR: 'Tive dificuldades para processar sua mensagem. Pode tentar novamente?',
};

@Injectable()
export class WhatsAppErrorHandler {
  private readonly logger = new Logger(WhatsAppErrorHandler.name);
  private readonly retryConfig: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    console.log('[WhatsAppErrorHandler] Constructor called with:', retryConfig);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    console.log('[WhatsAppErrorHandler] Initialized successfully');
  }

  /**
   * Trata erro e retorna resposta apropriada
   */
  handleError(error: Error, context: ErrorContext): FallbackResponse {
    console.log('[WhatsAppErrorHandler] handleError called', { error: error?.message, context });
    try {
      const errorType = this.classifyError(error);
      const errorMessage = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.UNKNOWN_ERROR;

      // Log do erro com contexto
      this.logError(error, context, errorType);

      // Determinar se deve fazer retry
      const shouldRetry = this.shouldRetry(error);
      const retryAfterMs = shouldRetry ? this.calculateRetryDelay(error) : undefined;

      // Determinar se deve escalar para humano
      const shouldEscalate = this.shouldEscalate(error);

      return {
        message: errorMessage,
        shouldRetry,
        retryAfterMs,
        escalate: shouldEscalate,
      };
    } catch (e) {
      console.error('[WhatsAppErrorHandler] Error in handleError:', e);
      return {
        message: ERROR_MESSAGES.UNKNOWN_ERROR,
        shouldRetry: false,
      };
    }
  }

  /**
   * Executa função com retry automático
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: ErrorContext,
    onRetry?: (attempt: number, error: Error) => void,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxRetries && this.shouldRetry(lastError)) {
          const delayMs = this.calculateRetryDelay(lastError);

          this.logger.warn(`Retry attempt ${attempt}/${this.retryConfig.maxRetries}`, {
            error: lastError.message,
            delayMs,
            ...context,
          });

          if (onRetry) {
            onRetry(attempt, lastError);
          }

          await this.sleep(delayMs);
        }
      }
    }

    // Todas as tentativas falharam
    throw lastError;
  }

  /**
   * Executa função com fallback em caso de erro
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    context: ErrorContext,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logError(err, context, this.classifyError(err));

      this.logger.log('Using fallback function', { ...context });
      return await fallbackFn();
    }
  }

  /**
   * Classifica tipo de erro
   */
  private classifyError(error: Error): keyof typeof ERROR_MESSAGES {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Erros de conexão
    if (
      message.includes('connect') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      name.includes('connection')
    ) {
      return 'CONNECTION_REFUSED';
    }

    if (message.includes('timeout') || name.includes('timeout')) {
      return 'CONNECTION_TIMEOUT';
    }

    if (message.includes('network') || name.includes('network')) {
      return 'NETWORK_ERROR';
    }

    // Erros de validação
    if (message.includes('validation') || message.includes('invalid input')) {
      return 'INVALID_INPUT';
    }

    if (message.includes('required') && message.includes('field')) {
      return 'MISSING_REQUIRED_FIELD';
    }

    if (message.includes('quantity') && (message.includes('invalid') || message.includes('min'))) {
      return 'INVALID_QUANTITY';
    }

    if (message.includes('phone') && (message.includes('invalid') || message.includes('format'))) {
      return 'INVALID_PHONE';
    }

    // Erros de negócio
    if (message.includes('out of stock') || message.includes('estoque')) {
      return 'OUT_OF_STOCK';
    }

    if (message.includes('price') && message.includes('changed')) {
      return 'PRICE_CHANGED';
    }

    if (message.includes('order') && message.includes('not found')) {
      return 'ORDER_NOT_FOUND';
    }

    if (message.includes('payment') && (message.includes('fail') || message.includes('error'))) {
      return 'PAYMENT_FAILED';
    }

    if (message.includes('coupon') && (message.includes('invalid') || message.includes('not found'))) {
      return 'COUPON_INVALID';
    }

    if (message.includes('coupon') && message.includes('expired')) {
      return 'COUPON_EXPIRED';
    }

    if (message.includes('coupon') && message.includes('already used')) {
      return 'COUPON_ALREADY_USED';
    }

    // Erros de carrinho
    if (message.includes('cart') && message.includes('expired')) {
      return 'CART_EXPIRED';
    }

    if (message.includes('cart') && message.includes('empty')) {
      return 'CART_EMPTY';
    }

    if (message.includes('cart') && message.includes('limit')) {
      return 'CART_LIMIT_REACHED';
    }

    // Erros de IA
    if (message.includes('ai') || message.includes('openai') || message.includes('llm')) {
      if (message.includes('timeout')) {
        return 'AI_TIMEOUT';
      }
      return 'AI_ERROR';
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'RATE_LIMIT_EXCEEDED';
    }

    if (message.includes('service unavailable') || message.includes('503')) {
      return 'SERVICE_UNAVAILABLE';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Determina se erro deve ser retentado
   */
  private shouldRetry(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Erros que NÃO devem ser retentados
    const noRetryErrors = [
      'validation',
      'invalid input',
      'not found',
      'coupon invalid',
      'coupon expired',
      'coupon already used',
      'out of stock',
      'permission denied',
      'unauthorized',
    ];

    for (const errorType of noRetryErrors) {
      if (message.includes(errorType)) {
        return false;
      }
    }

    // Erros que DEVEM ser retentados
    const retryErrors = [
      'connection',
      'timeout',
      'network',
      'econnrefused',
      'etimedout',
      'eai_again',
      '503',
      '502',
      '504',
      'rate limit',
      'too many requests',
    ];

    for (const errorType of retryErrors) {
      if (message.includes(errorType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determina se erro deve escalar para humano
   */
  private shouldEscalate(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Escalar para humano em casos graves
    const escalateErrors = [
      'payment failed',
      'security',
      'permission denied',
      'unauthorized',
      'system error',
      'data corruption',
    ];

    for (const errorType of escalateErrors) {
      if (message.includes(errorType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calcula delay para retry com exponential backoff
   */
  private calculateRetryDelay(error: Error): number {
    const baseDelay = this.retryConfig.baseDelayMs;
    const maxDelay = this.retryConfig.maxDelayMs;
    const exponentialBase = this.retryConfig.exponentialBase;

    // Adicionar jitter aleatório (0-25% do delay)
    const jitter = Math.random() * 0.25 * baseDelay;

    // Calcular delay exponencial
    let delay = baseDelay * Math.pow(exponentialBase, 0); // Simplificado para 1 retry

    // Limit to max
    delay = Math.min(delay + jitter, maxDelay);

    return Math.round(delay);
  }

  /**
   * Log de erro estruturado
   */
  private logError(error: Error, context: ErrorContext, errorType: string): void {
    this.logger.error('WhatsApp error', {
      errorType,
      errorMessage: error.message,
      errorStack: error.stack,
      context: {
        tenantId: context.tenantId,
        customerPhone: context.customerPhone,
        messageId: context.messageId,
        action: context.action,
        metadata: context.metadata,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Helper para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gera mensagem de erro amigável para o cliente
   */
  generateFriendlyErrorMessage(errorType: keyof typeof ERROR_MESSAGES): string {
    const baseMessage = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.UNKNOWN_ERROR;

    // Adicionar contexto baseado no tipo de erro
    switch (errorType) {
      case 'OUT_OF_STOCK':
        return `${baseMessage}\n\nPosso mostrar outros produtos disponíveis?`;
      case 'CART_EXPIRED':
        return baseMessage;
      case 'PAYMENT_FAILED':
        return `${baseMessage}\n\nPosso ajudar com outra forma de pagamento?`;
      case 'AI_TIMEOUT':
        return baseMessage;
      case 'RATE_LIMIT_EXCEEDED':
        return `Você está enviando mensagens muito rápido.${baseMessage}`;
      default:
        return baseMessage;
    }
  }
}