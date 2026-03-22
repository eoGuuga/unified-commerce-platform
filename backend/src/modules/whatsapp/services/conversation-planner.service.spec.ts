import { ConversationPlannerService } from './conversation-planner.service';
import { ConversationalIntelligenceService } from './conversational-intelligence.service';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesIntelligenceService } from './sales-intelligence.service';

describe('ConversationPlannerService', () => {
  const messageIntelligenceService = new MessageIntelligenceService();
  const conversationalIntelligenceService = new ConversationalIntelligenceService(
    messageIntelligenceService,
  );
  const salesIntelligenceService = new SalesIntelligenceService(messageIntelligenceService);
  const service = new ConversationPlannerService();

  it('prioritizes step guidance for clarification inside active collection', () => {
    const plan = service.buildPlan({
      message: 'por que precisa disso agora?',
      conversationalAnalysis: conversationalIntelligenceService.analyze(
        'por que precisa disso agora?',
      ),
      salesAnalysis: salesIntelligenceService.analyze('por que precisa disso agora?'),
      currentState: 'collecting_phone',
    });

    expect(plan.mode).toBe('step_guidance');
    expect(plan.shouldOverrideTransactional).toBe(true);
  });

  it('prioritizes issue recovery when the customer says something is wrong during a flow', () => {
    const plan = service.buildPlan({
      message: 'nao ta certo, voce confundiu meu pedido',
      conversationalAnalysis: conversationalIntelligenceService.analyze(
        'nao ta certo, voce confundiu meu pedido',
      ),
      salesAnalysis: salesIntelligenceService.analyze('nao ta certo, voce confundiu meu pedido'),
      currentState: 'confirming_order',
    });

    expect(plan.mode).toBe('issue_recovery');
    expect(plan.customerGoal).toContain('corrigir');
  });

  it('prioritizes context recap when the customer asks what the bot already understood', () => {
    const plan = service.buildPlan({
      message: 'me resume o que voce entendeu ate agora',
      conversationalAnalysis: conversationalIntelligenceService.analyze(
        'me resume o que voce entendeu ate agora',
      ),
      salesAnalysis: salesIntelligenceService.analyze('me resume o que voce entendeu ate agora'),
      currentState: 'confirming_order',
    });

    expect(plan.mode).toBe('context_recap');
    expect(plan.shouldOverrideTransactional).toBe(true);
    expect(plan.customerGoal).toContain('revisar');
  });

  it('opens a consultative sales bridge when the customer is hesitant after a recommendation context', () => {
    const plan = service.buildPlan({
      message: 'to meio perdida ainda',
      conversationalAnalysis: conversationalIntelligenceService.analyze('to meio perdida ainda'),
      salesAnalysis: salesIntelligenceService.analyze('to meio perdida ainda'),
      memory: {
        last_intent: 'recommendation',
      },
    });

    expect(plan.mode).toBe('sales_consultative');
    expect(plan.offerSalesBridge).toBe(true);
  });

  it('keeps post-order support safe for payment issues', () => {
    const plan = service.buildPlan({
      message: 'deu ruim no pix',
      conversationalAnalysis: conversationalIntelligenceService.analyze('deu ruim no pix'),
      salesAnalysis: salesIntelligenceService.analyze('deu ruim no pix'),
      currentState: 'waiting_payment',
    });

    expect(plan.mode).toBe('post_order_support');
    expect(plan.customerGoal).toContain('pagamento');
  });

  it('keeps context recap available after order creation too', () => {
    const plan = service.buildPlan({
      message: 'como ficou meu pedido agora?',
      conversationalAnalysis: conversationalIntelligenceService.analyze(
        'como ficou meu pedido agora?',
      ),
      salesAnalysis: salesIntelligenceService.analyze('como ficou meu pedido agora?'),
      currentState: 'waiting_payment',
    });

    expect(plan.mode).toBe('context_recap');
    expect(plan.customerGoal).toContain('pedido');
  });
});
