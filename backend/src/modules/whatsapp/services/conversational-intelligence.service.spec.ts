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

  it('detects gratitude without confusing it with a transactional command', () => {
    const analysis = service.analyze('obrigado, valeu');

    expect(analysis.intent).toBe('gratitude');
    expect(analysis.signals.gratitude).toBe(true);
  });
});
