import {
  buildContextRecapMessage,
  buildMemoryAwareHandoffMessage,
  isConversationalUnresolvedFeedback,
} from './conversation-messages';

describe('conversation-messages utils', () => {
  describe('buildMemoryAwareHandoffMessage', () => {
    it('inclui lead, frase de mastigado, header, summary e guidance', () => {
      const msg = buildMemoryAwareHandoffMessage(
        'Vou passar para um humano agora.',
        ['- Cliente: Maria', '- Etapa atual: collecting_address'],
        'Aguarde um momento por favor.',
      );

      expect(msg).toContain('Vou passar para um humano agora.');
      expect(msg).toContain('mastigado para atendimento humano');
      expect(msg).toContain('RESUMO PRONTO PARA ATENDIMENTO');
      expect(msg).toContain('- Cliente: Maria');
      expect(msg).toContain('- Etapa atual: collecting_address');
      expect(msg).toContain('Aguarde um momento por favor.');
    });

    it('aceita lista de summary vazia (apenas header sem itens)', () => {
      const msg = buildMemoryAwareHandoffMessage(
        'lead',
        [],
        'guidance',
      );
      expect(msg).toContain('RESUMO PRONTO PARA ATENDIMENTO');
      expect(msg).toContain('guidance');
    });
  });

  describe('buildContextRecapMessage', () => {
    it('inclui lead, header, summary lines e guidance', () => {
      const msg = buildContextRecapMessage(
        'Olha so o que ja vi:',
        ['- Pedido: PED-0001', '- Total: R$ 99,90'],
        'Posso continuar?',
      );

      expect(msg).toContain('Olha so o que ja vi:');
      expect(msg).toContain('RESUMO DO QUE JA ENTENDI');
      expect(msg).toContain('- Pedido: PED-0001');
      expect(msg).toContain('- Total: R$ 99,90');
      expect(msg).toContain('Posso continuar?');
    });

    it('mostra placeholder quando summary vazio', () => {
      const msg = buildContextRecapMessage('lead', [], 'guidance');
      expect(msg).toContain(
        '- Ainda nao tenho contexto suficiente travado aqui.',
      );
    });
  });

  describe('isConversationalUnresolvedFeedback', () => {
    it.each([
      ['nao ajudou', true],
      ['isso nao ajudou', true],
      ['nao resolveu nada', true],
      ['continua sem resolver mesmo', true],
      ['nao era bem isso', true],
      ['ainda nao resolveu', true],
      ['obrigado, muito bom', false],
      ['', false],
      ['preciso de ajuda', false],
    ])('para "%s" retorna %s', (input, expected) => {
      expect(isConversationalUnresolvedFeedback(input)).toBe(expected);
    });
  });
});
