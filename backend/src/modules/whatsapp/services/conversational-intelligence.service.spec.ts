import { ConversationalIntelligenceService } from './conversational-intelligence.service';
import { MessageIntelligenceService } from './message-intelligence.service';

describe('ConversationalIntelligenceService', () => {
  const service = new ConversationalIntelligenceService(new MessageIntelligenceService());

  it('detects clarification and confusion language', () => {
    const analysis = service.analyze('nao entendi, o que voce precisa agora?');

    expect(analysis.intent).toBe('clarification');
    expect(analysis.signals.clarification).toBe(true);
  });

  it('detects operational issues outside the main flow', () => {
    const analysis = service.analyze('deu ruim no pix, nao apareceu');

    expect(analysis.intent).toBe('issue');
    expect(analysis.signals.issue).toBe(true);
  });

  it('detects requests to talk to a human', () => {
    const analysis = service.analyze('quero falar com alguem porque nao entendeu');

    expect(analysis.intent).toBe('handoff');
    expect(analysis.signals.handoff).toBe(true);
  });

  it('detects recap requests without confusing them with a new transactional step', () => {
    const analysis = service.analyze('me resume o que voce entendeu ate agora');

    expect(analysis.intent).toBe('recap');
    expect(analysis.signals.recap).toBe(true);
  });

  it('detects gratitude without confusing it with a transactional command', () => {
    const analysis = service.analyze('obrigado, valeu');

    expect(analysis.intent).toBe('gratitude');
    expect(analysis.signals.gratitude).toBe(true);
  });

  it('detects reassurance-seeking posture in trust-sensitive messages', () => {
    const analysis = service.analyze('nao quero errar, me confirma se vai dar certo');

    expect(analysis.posture).toBe('reassurance');
    expect(analysis.signals.reassurance).toBe(true);
    expect(analysis.responseStyle.reassurance).toBe(true);
  });

  it('detects urgency posture without confusing it with an issue', () => {
    const analysis = service.analyze('preciso resolver isso rapido agora');

    expect(analysis.posture).toBe('urgent');
    expect(analysis.signals.urgency).toBe(true);
    expect(analysis.responseStyle.directness).toBe(true);
  });

  it('detects frustrated posture when the customer is clearly upset', () => {
    const analysis = service.analyze('ta confuso, to frustrado com isso');

    expect(analysis.posture).toBe('frustrated');
    expect(analysis.signals.frustration).toBe(true);
    expect(analysis.responseStyle.empathy).toBe(true);
  });
});
