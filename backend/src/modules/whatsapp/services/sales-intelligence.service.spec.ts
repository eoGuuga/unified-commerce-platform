import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesIntelligenceService } from './sales-intelligence.service';

describe('SalesIntelligenceService', () => {
  const service = new SalesIntelligenceService(new MessageIntelligenceService());

  it('detects budget-led sales conversations', () => {
    const analysis = service.analyze('quero algo ate 12 reais');

    expect(analysis.intent).toBe('budget');
    expect(analysis.budgetCeiling).toBe(12);
    expect(analysis.pricePreference).toBe('budget');
  });

  it('detects product comparison conversations', () => {
    const analysis = service.analyze('qual vale mais a pena brownie premium ou brigadeiro gourmet');

    expect(analysis.intent).toBe('comparison');
    expect(analysis.signals.comparison).toBe(true);
  });

  it('detects price objections as sales guidance instead of trivia', () => {
    const analysis = service.analyze('ta caro, tem algo mais em conta?');

    expect(analysis.intent).toBe('objection');
    expect(analysis.objectionType).toBe('price');
    expect(analysis.pricePreference).toBe('budget');
  });

  it('detects recommendation context for gift conversations', () => {
    const analysis = service.analyze('nao sei qual escolher para presente');

    expect(analysis.intent).toBe('recommendation');
    expect(analysis.useCaseTags).toContain('gift');
  });
});
