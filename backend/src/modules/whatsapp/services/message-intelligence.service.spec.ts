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

  it('understands conversational wanting phrasing as order intent', () => {
    const analysis = service.analyze('to querendo 2 brigadeiro gourmet por favor');

    expect(analysis.primaryIntent).toBe('fazer_pedido');
    expect(analysis.quantity).toBe(2);
    expect(analysis.productCandidate).toContain('brigadeiro gourmet');
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

  it('reuses the last ordered item for "o mesmo"', () => {
    const analysis = service.analyzeWithContext('o mesmo', {
      lastIntent: 'order',
      lastProductName: 'Brigadeiro Gourmet',
      lastProductNames: ['Brigadeiro Gourmet'],
      lastQuantity: 2,
    });

    expect(analysis.contextualIntent).toBe('fazer_pedido');
    expect(analysis.contextualProductCandidate).toBe('Brigadeiro Gourmet');
    expect(analysis.contextualQuantity).toBe(2);
  });

  it('maps numeric suggestion replies to the remembered product and quantity', () => {
    const analysis = service.analyzeWithContext('2', {
      lastIntent: 'suggestion',
      lastProductNames: ['Brigadeiro Gourmet', 'Brownie Premium'],
      lastQuantity: 3,
    });

    expect(analysis.contextualIntent).toBe('fazer_pedido');
    expect(analysis.contextualProductCandidate).toBe('Brownie Premium');
    expect(analysis.contextualQuantity).toBe(3);
  });

  it('keeps consult context when selecting a price suggestion by number', () => {
    const analysis = service.analyzeWithContext('1', {
      lastIntent: 'price',
      lastProductNames: ['Brigadeiro Gourmet', 'Brownie Premium'],
    });

    expect(analysis.contextualIntent).toBe('consultar');
    expect(analysis.contextualProductCandidate).toBe('Brigadeiro Gourmet');
  });
});
