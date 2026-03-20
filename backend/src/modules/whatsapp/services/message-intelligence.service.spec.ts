import { MessageIntelligenceService } from './message-intelligence.service';

describe('MessageIntelligenceService', () => {
  const service = new MessageIntelligenceService();

  it('classifies noisy order messages as order intent', () => {
    const analysis = service.analyze('qro 2 brigadeiro gourmet pfv');

    expect(analysis.primaryIntent).toBe('fazer_pedido');
    expect(analysis.quantity).toBe(2);
    expect(analysis.productCandidate).toContain('brigadeiro gourmet');
    expect(analysis.scores.order).toBeGreaterThanOrEqual(0.72);
  });

  it('detects explicit cancel intent', () => {
    const analysis = service.analyze('cancela meu pedido agora');

    expect(analysis.primaryIntent).toBe('cancelar');
    expect(analysis.flags.explicitCancel).toBe(true);
    expect(analysis.scores.cancel).toBeGreaterThanOrEqual(0.72);
  });

  it('detects status intent from natural customer tracking language', () => {
    const analysis = service.analyze('kd o motoboy do meu pedido');

    expect(analysis.primaryIntent).toBe('consultar');
    expect(analysis.scores.status).toBeGreaterThanOrEqual(0.72);
  });

  it('detects resume intent from conversational phrasing', () => {
    const analysis = service.analyze('bora continuar meu pedido de onde parei');

    expect(analysis.primaryIntent).toBe('consultar');
    expect(analysis.scores.reopen).toBeGreaterThanOrEqual(0.72);
  });

  it('avoids treating soft cancellation phrasing as a fresh order', () => {
    const analysis = service.analyze('nao vou querer mais');

    expect(analysis.flags.negativeOrder).toBe(true);
    expect(analysis.scores.order).toBeLessThan(0.5);
  });
});
