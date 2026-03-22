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

  it('detects richer confectionery occasions beyond generic recommendation intent', () => {
    const analysis = service.analyze(
      'quero algo mais premium e chocolatudo pra mim, mas que eu consiga dividir depois',
    );

    expect(analysis.intent).toBe('recommendation');
    expect(analysis.useCaseTags).toEqual(
      expect.arrayContaining(['premium', 'chocolate_focus', 'self_treat', 'sharing']),
    );
  });

  it('reads combined sales intent, recipient and reassurance in the same message', () => {
    const analysis = service.analyze(
      'me indica um presente pra minha mae ate 40 reais, sem erro e sem perder tempo',
    );

    expect(analysis.intent).toBe('recommendation');
    expect(analysis.secondaryIntents).toContain('budget');
    expect(analysis.useCaseTags).toContain('gift');
    expect(analysis.recipientHint).toBe('sua mae');
    expect(analysis.decisionStage).toBe('refining');
    expect(analysis.conversationDrivers).toEqual(
      expect.arrayContaining(['urgency', 'reassurance', 'recipient_context', 'value_pressure']),
    );
  });

  it('detects a simpler lower-friction buying style when the customer wants something discreet', () => {
    const analysis = service.analyze(
      'quero uma lembrancinha mais simples, sem exagero e mais em conta',
    );

    expect(analysis.intent).toBe('recommendation');
    expect(analysis.secondaryIntents).toContain('budget');
    expect(analysis.conversationDrivers).toEqual(
      expect.arrayContaining(['simplicity', 'value_pressure']),
    );
  });
});
