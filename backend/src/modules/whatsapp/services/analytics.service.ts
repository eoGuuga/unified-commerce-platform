import { Injectable, Logger } from '@nestjs/common';
import { DbContextService } from '../../common/services/db-context.service';

export interface MessageMetrics {
  tenantId: string;
  timestamp: Date;
  messageId: string;
  customerPhone: string;
  direction: 'inbound' | 'outbound';
  messageType: 'text' | 'image' | 'document' | 'button' | 'audio';
  processingTimeMs: number;
  intent?: string;
  action?: string;
  success: boolean;
  errorMessage?: string;
}

export interface ConversationMetrics {
  conversationId: string;
  tenantId: string;
  customerPhone: string;
  startedAt: Date;
  endedAt?: Date;
  durationMinutes?: number;
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  intentDistribution: Record<string, number>;
  actionDistribution: Record<string, number>;
  conversionEvents: string[];
  abandonmentPoint?: string;
  averageResponseTimeMs: number;
}

export interface SalesMetrics {
  tenantId: string;
  date: string;
  cartCreatedCount: number;
  cartConvertedCount: number;
  cartAbandonedCount: number;
  conversionRate: number;
  averageCartValue: number;
  totalSalesValue: number;
  topProducts: Array<{ productId: string; productName: string; quantity: number; revenue: number }>;
  paymentMethodDistribution: Record<string, number>;
}

export interface BotPerformanceMetrics {
  tenantId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalMessages: number;
  uniqueCustomers: number;
  averageResponseTimeMs: number;
  p95ResponseTimeMs: number;
  successRate: number;
  errorRate: number;
  escalationRate: number;
  topIntents: Array<{ intent: string; count: number; percentage: number }>;
  topErrors: Array<{ errorType: string; count: number }>;
  averageConversationLength: number;
}

@Injectable()
export class WhatsAppAnalyticsService {
  private readonly logger = new Logger(WhatsAppAnalyticsService.name);

  /**
   * Escrita de metricas DESLIGADA ate o bot estar ao vivo em producao.
   *
   * Motivo: os metodos de escrita (track*) nunca funcionaram — a resolucao de
   * repositorio usa nomes que nao batem com a entidade/tabela (ex.:
   * 'WhatsappMessageMetrics' vs a classe `WhatsAppMessageMetrics` / tabela
   * `whatsapp_message_metrics`). Cada chamada lancava, caia no catch e logava em
   * nivel `error` → disparava o app-alert no Telegram A CADA mensagem do bot.
   * Como o analytics ainda nao e usado (nenhum dashboard ligado; bot nao esta ao
   * vivo), curto-circuitamos a escrita: zero write, zero alarme, zero PII no log.
   *
   * PARA RELIGAR (quando o bot estiver ao vivo — ver frente do bot), NAO basta
   * inverter este flag; os 3 defeitos precisam ser corrigidos juntos:
   *   1. NOME do repositorio: usar a classe da entidade (`WhatsAppMessageMetrics`,
   *      `WhatsAppConversationMetrics`, `WhatsAppConversionEvent`,
   *      `WhatsAppAbandonmentEvent`) ou o nome exato da tabela.
   *   2. PAYLOAD: `trackMessage`/`trackConversation` gravam chaves camelCase
   *      (tenantId, messageId…), mas as colunas sao snake_case NOT NULL
   *      (tenant_id, message_id…) → mapear. (trackConversion/trackAbandonment ja
   *      montam snake_case.)
   *   3. CONTEXTO RLS: a escrita roda fora do request → setar
   *      `app.current_tenant_id` numa transacao (padrao em `cart.service.ts`)
   *      antes do INSERT, senao o RLS (FORCE + WITH CHECK) rejeita.
   * Os metodos de LEITURA (getBotPerformanceMetrics/getSalesMetrics) tem os
   * mesmos defeitos 1/2 e fazem parte do mesmo trabalho adiado.
   */
  private static readonly WRITE_ENABLED = false;

  constructor(private readonly db: DbContextService) {}

  /**
   * Registra métricas de uma mensagem
   */
  async trackMessage(metrics: MessageMetrics): Promise<void> {
    if (!WhatsAppAnalyticsService.WRITE_ENABLED) return; // escrita adiada (ver doc da classe)
    try {
      const repo = this.db.getRepository('WhatsappMessageMetrics');
      await repo.save({
        ...metrics,
        created_at: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to track message metrics', { error, metrics });
    }
  }

  /**
   * Registra métricas de uma conversa
   */
  async trackConversation(metrics: ConversationMetrics): Promise<void> {
    if (!WhatsAppAnalyticsService.WRITE_ENABLED) return; // escrita adiada (ver doc da classe)
    try {
      const repo = this.db.getRepository('WhatsappConversationMetrics');
      await repo.save({
        ...metrics,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to track conversation metrics', { error, metrics });
    }
  }

  /**
   * Registra evento de conversão (carrinho → pedido)
   */
  async trackConversion(
    tenantId: string,
    customerPhone: string,
    cartId: string,
    orderId: string,
    value: number,
  ): Promise<void> {
    if (!WhatsAppAnalyticsService.WRITE_ENABLED) return; // escrita adiada (ver doc da classe)
    try {
      const repo = this.db.getRepository('WhatsappConversionEvents');
      await repo.save({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        cart_id: cartId,
        order_id: orderId,
        conversion_value: value,
        converted_at: new Date(),
        created_at: new Date(),
      });

      this.logger.log('Conversion tracked', { tenantId, cartId, orderId, value });
    } catch (error) {
      this.logger.error('Failed to track conversion', { error, tenantId, cartId, orderId });
    }
  }

  /**
   * Registra evento de abandono
   */
  async trackAbandonment(
    tenantId: string,
    customerPhone: string,
    cartId: string,
    abandonmentPoint: string,
    cartValue: number,
  ): Promise<void> {
    if (!WhatsAppAnalyticsService.WRITE_ENABLED) return; // escrita adiada (ver doc da classe)
    try {
      const repo = this.db.getRepository('WhatsappAbandonmentEvents');
      await repo.save({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        cart_id: cartId,
        abandonment_point: abandonmentPoint,
        cart_value: cartValue,
        abandoned_at: new Date(),
        created_at: new Date(),
      });

      this.logger.log('Abandonment tracked', { tenantId, cartId, abandonmentPoint });
    } catch (error) {
      this.logger.error('Failed to track abandonment', { error, tenantId, cartId });
    }
  }

  /**
   * Busca métricas de performance do bot
   */
  async getBotPerformanceMetrics(
    tenantId: string,
    period: 'hour' | 'day' | 'week' | 'month',
    limit: number = 100,
  ): Promise<BotPerformanceMetrics> {
    const repo = this.db.getRepository('WhatsappMessageMetrics');

    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);

    const messages = await repo.find({
      where: {
        tenant_id: tenantId,
        created_at: MoreThan(periodStart) as any,
      },
      order: { created_at: 'DESC' },
      take: limit,
    });

    const uniqueCustomers = new Set(messages.map((m) => m.customer_phone)).size;
    const successCount = messages.filter((m) => m.success).length;
    const errorCount = messages.length - successCount;

    // Calcular intent distribution
    const intentDistribution: Record<string, number> = {};
    const actionDistribution: Record<string, number> = {};

    messages.forEach((m) => {
      if (m.intent) {
        intentDistribution[m.intent] = (intentDistribution[m.intent] || 0) + 1;
      }
      if (m.action) {
        actionDistribution[m.action] = (actionDistribution[m.action] || 0) + 1;
      }
    });

    // Top intents
    const topIntents = Object.entries(intentDistribution)
      .map(([intent, count]) => ({
        intent,
        count,
        percentage: (count / messages.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top errors
    const errorDistribution: Record<string, number> = {};
    messages
      .filter((m) => !m.success && m.errorMessage)
      .forEach((m) => {
        errorDistribution[m.errorMessage!] = (errorDistribution[m.errorMessage!] || 0) + 1;
      });

    const topErrors = Object.entries(errorDistribution)
      .map(([errorMessage, count]) => ({ errorType: errorMessage, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calcular tempos de resposta
    const responseTimes = messages.map((m) => m.processingTimeMs).sort((a, b) => a - b);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p95ResponseTime = responseTimes[p95Index] || 0;

    return {
      tenantId,
      period,
      totalMessages: messages.length,
      uniqueCustomers,
      averageResponseTimeMs: Math.round(avgResponseTime),
      p95ResponseTimeMs: p95ResponseTime,
      successRate: messages.length > 0 ? (successCount / messages.length) * 100 : 0,
      errorRate: messages.length > 0 ? (errorCount / messages.length) * 100 : 0,
      escalationRate: 0, // TODO: implementar
      topIntents,
      topErrors,
      averageConversationLength: 0, // TODO: implementar
    };
  }

  /**
   * Busca métricas de vendas
   */
  async getSalesMetrics(tenantId: string, startDate: Date, endDate: Date): Promise<SalesMetrics> {
    const conversionRepo = this.db.getRepository('WhatsappConversionEvents');
    const abandonmentRepo = this.db.getRepository('WhatsappAbandonmentEvents');

    const conversions = await conversionRepo.find({
      where: {
        tenant_id: tenantId,
        converted_at: Between(startDate, endDate) as any,
      },
    });

    const abandonments = await abandonmentRepo.find({
      where: {
        tenant_id: tenantId,
        abandoned_at: Between(startDate, endDate) as any,
      },
    });

    const cartCreated = conversions.length + abandonments.length;
    const cartConverted = conversions.length;
    const cartAbandoned = abandonments.length;
    const conversionRate = cartCreated > 0 ? (cartConverted / cartCreated) * 100 : 0;
    const averageCartValue = conversions.length > 0
      ? conversions.reduce((sum, c) => sum + c.conversion_value, 0) / conversions.length
      : 0;
    const totalSalesValue = conversions.reduce((sum, c) => sum + c.conversion_value, 0);

    // TODO: Implementar topProducts e paymentMethodDistribution

    return {
      tenantId,
      date: startDate.toISOString().split('T')[0],
      cartCreatedCount: cartCreated,
      cartConvertedCount: cartConverted,
      cartAbandonedCount: cartAbandoned,
      conversionRate,
      averageCartValue,
      totalSalesValue,
      topProducts: [],
      paymentMethodDistribution: {},
    };
  }

  /**
   * Gera relatório de kesehatan do bot
   */
  async generateHealthReport(tenantId: string): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const metrics = await this.getBotPerformanceMetrics(tenantId, 'hour', 1000);

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Verificar taxa de erro
    if (metrics.errorRate > 20) {
      issues.push(`Taxa de erro muito alta: ${metrics.errorRate.toFixed(1)}%`);
      recommendations.push('Verificar logs de erro e corrigir problemas');
    }

    // Verificar tempo de resposta
    if (metrics.averageResponseTimeMs > 5000) {
      issues.push(`Tempo de resposta alto: ${metrics.averageResponseTimeMs}ms`);
      recommendations.push('Considerar otimização de queries e cache');
    }

    // Verificar taxa de escalação
    if (metrics.escalationRate > 10) {
      issues.push(`Taxa de escalação alta: ${metrics.escalationRate.toFixed(1)}%`);
      recommendations.push('Revisar fluxos e treinar modelo de classificação');
    }

    // Verificar intents não tratados
    const unhandledIntents = metrics.topIntents.filter(
      (i) => i.intent === 'other' || i.percentage > 20,
    );
    if (unhandledIntents.length > 0) {
      issues.push(`${unhandledIntents.length} intents com alta frequência não classificados`);
      recommendations.push('Melhorar classificação de intents');
    }

    // Determinar status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (issues.length >= 3) {
      status = 'critical';
    } else if (issues.length >= 1) {
      status = 'degraded';
    }

    return { status, issues, recommendations };
  }

  // ============== MÉTODOS PRIVADOS ==============

  private getPeriodStart(date: Date, period: 'hour' | 'day' | 'week' | 'month'): Date {
    const result = new Date(date);

    switch (period) {
      case 'hour':
        result.setMinutes(0, 0, 0);
        break;
      case 'day':
        result.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const day = result.getDay();
        result.setDate(result.getDate() - day);
        result.setHours(0, 0, 0, 0);
        break;
      case 'month':
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        break;
    }

    return result;
  }
}

// Helpers para TypeORM
function MoreThan(date: Date) {
  return date;
}
function Between(start: Date, end: Date) {
  return { $gte: start, $lte: end };
}