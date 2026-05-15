import {
  DEFAULT_HORARIO_FUNCIONAMENTO,
  PREMIUM_ADDRESS_PROMPT,
  PREMIUM_CARD_PAYMENT_FALLBACK_MESSAGE,
  PREMIUM_CONTEXT_RECOVERY_MESSAGE,
  PREMIUM_FALLBACK_MESSAGE,
  PREMIUM_FLOW_CONTROL_CLARIFICATION_MESSAGE,
  PREMIUM_GREETING_MESSAGE,
  PREMIUM_HELP_MESSAGE,
  PREMIUM_NON_COMMERCIAL_RECOVERY_MESSAGE,
  PREMIUM_NOTES_PROMPT,
  PREMIUM_ORDER_CHOICE_CLARIFICATION_MESSAGE,
  PREMIUM_ORDER_NUDGE_MESSAGE,
  PREMIUM_PHONE_PROMPT,
  PREMIUM_SOFT_RESET_MESSAGE,
  buildPremiumAddressDraftPrompt,
  buildPremiumBoundaryMessage,
  buildPremiumDeliveryChoicePrompt,
  buildPremiumDeliveryChoiceValidationMessage,
  buildPremiumScheduleMessage,
  getPaymentOptionsMessage,
  looksLikeExplicitNameIntroduction,
} from './static-messages';

describe('static-messages utils', () => {
  describe('constantes', () => {
    it('PREMIUM_SOFT_RESET_MESSAGE menciona cardapio e ajuda', () => {
      expect(PREMIUM_SOFT_RESET_MESSAGE).toContain('cardapio');
      expect(PREMIUM_SOFT_RESET_MESSAGE).toContain('ajuda');
    });

    it('PREMIUM_NON_COMMERCIAL_RECOVERY_MESSAGE pede explicacao', () => {
      expect(PREMIUM_NON_COMMERCIAL_RECOVERY_MESSAGE).toContain(
        'me explicar',
      );
    });

    it('PREMIUM_CARD_PAYMENT_FALLBACK_MESSAGE oferece PIX e dinheiro', () => {
      expect(PREMIUM_CARD_PAYMENT_FALLBACK_MESSAGE).toContain('PIX');
      expect(PREMIUM_CARD_PAYMENT_FALLBACK_MESSAGE).toContain('dinheiro');
    });

    it('PREMIUM_ADDRESS_PROMPT inclui exemplo completo', () => {
      expect(PREMIUM_ADDRESS_PROMPT).toContain('ENDERECO DE ENTREGA');
      expect(PREMIUM_ADDRESS_PROMPT).toContain('Rua das Flores');
    });
  });

  describe('buildPremiumAddressDraftPrompt', () => {
    it('sem numero -> pede o numero', () => {
      const msg = buildPremiumAddressDraftPrompt('Rua das Flores', false);
      expect(msg).toContain('Agora me envie o numero');
    });

    it('com numero mas sem estado -> pede bairro/cidade/estado', () => {
      const msg = buildPremiumAddressDraftPrompt('Rua A 100', false);
      expect(msg).toContain('bairro, cidade e estado');
    });

    it('com numero e estado mas sem CEP -> pede CEP/complemento', () => {
      const msg = buildPremiumAddressDraftPrompt(
        'Rua A 100, Centro, SP',
        true,
      );
      expect(msg).toContain('CEP ou complemento');
    });

    it('completo -> sugere apenas complemento', () => {
      const msg = buildPremiumAddressDraftPrompt(
        'Rua A 100, Centro, SP, 01000-000',
        true,
      );
      expect(msg).toContain('complete com complemento');
    });
  });

  describe('getPaymentOptionsMessage', () => {
    it('calcula PIX com 5% de desconto', () => {
      const msg = getPaymentOptionsMessage(100);
      expect(msg).toContain('PIX');
      expect(msg).toContain('R$ 95,00'); // 100 * 0.95
      expect(msg).toContain('Dinheiro');
    });

    it('aceita zero (pixAmount = 0)', () => {
      const msg = getPaymentOptionsMessage(0);
      expect(msg).toContain('R$ 0,00');
    });
  });

  describe('looksLikeExplicitNameIntroduction', () => {
    it.each([
      ['meu nome e Maria', true],
      ['me chamo Joao', true],
      ['eu sou Ana', true],
      ['sou o Carlos', true],
      ['prazer, Marta', true],
      ['Maria Silva', false],
      ['oi quero brigadeiro', false],
      ['', false],
    ])('para "%s" retorna %s', (input, expected) => {
      expect(looksLikeExplicitNameIntroduction(input)).toBe(expected);
    });
  });

  describe('outras constantes premium', () => {
    it('DEFAULT_HORARIO_FUNCIONAMENTO menciona Segunda a Sabado', () => {
      expect(DEFAULT_HORARIO_FUNCIONAMENTO).toMatch(/Segunda/i);
      expect(DEFAULT_HORARIO_FUNCIONAMENTO).toMatch(/S[áa]bado/i);
    });

    it('PREMIUM_PHONE_PROMPT inclui exemplos de telefone', () => {
      expect(PREMIUM_PHONE_PROMPT).toContain('TELEFONE DE CONTATO');
      expect(PREMIUM_PHONE_PROMPT).toContain('11987654321');
    });

    it('PREMIUM_NOTES_PROMPT diz como skipar', () => {
      expect(PREMIUM_NOTES_PROMPT).toContain('OBSERVACOES');
      expect(PREMIUM_NOTES_PROMPT).toContain('"sem"');
    });

    it('PREMIUM_HELP_MESSAGE lista atalhos', () => {
      expect(PREMIUM_HELP_MESSAGE).toContain('cardapio');
      expect(PREMIUM_HELP_MESSAGE).toContain('status do pedido');
    });

    it('PREMIUM_GREETING_MESSAGE menciona concierge', () => {
      expect(PREMIUM_GREETING_MESSAGE).toMatch(/concierge/i);
    });

    it('PREMIUM_FALLBACK_MESSAGE lista exemplos de atalhos', () => {
      expect(PREMIUM_FALLBACK_MESSAGE).toContain('"quero 10 brigadeiros"');
    });
  });

  describe('buildPremiumDeliveryChoicePrompt', () => {
    it('saudacao personalizada com nome', () => {
      const msg = buildPremiumDeliveryChoicePrompt('Maria');
      expect(msg.split('\n')[0]).toBe('Perfeito, Maria.');
      expect(msg).toContain('Entrega');
      expect(msg).toContain('Retirada');
    });

    it('saudacao generica sem nome', () => {
      const msg = buildPremiumDeliveryChoicePrompt();
      expect(msg.split('\n')[0]).toBe('Perfeito.');
    });
  });

  describe('buildPremiumDeliveryChoiceValidationMessage', () => {
    it('explica que precisa alinhar entrega vs retirada', () => {
      const msg = buildPremiumDeliveryChoiceValidationMessage('Joao');
      expect(msg).toContain('Joao');
      expect(msg).toContain('alinhar se vai ser entrega ou retirada');
    });
  });

  describe('buildPremiumScheduleMessage', () => {
    it('inclui o horario passado', () => {
      const msg = buildPremiumScheduleMessage(DEFAULT_HORARIO_FUNCIONAMENTO);
      expect(msg).toContain('HORARIO DE ATENDIMENTO');
      expect(msg).toContain(DEFAULT_HORARIO_FUNCIONAMENTO);
    });

    it('aceita horario customizado', () => {
      const custom = '24h por dia';
      expect(buildPremiumScheduleMessage(custom)).toContain(custom);
    });
  });

  describe('outros premium static (clarification/nudge/recovery)', () => {
    it('PREMIUM_ORDER_CHOICE_CLARIFICATION_MESSAGE pede uma escolha por vez', () => {
      expect(PREMIUM_ORDER_CHOICE_CLARIFICATION_MESSAGE).toContain(
        'uma decisao por vez',
      );
      expect(PREMIUM_ORDER_CHOICE_CLARIFICATION_MESSAGE).toContain(
        'brigadeiro gourmet',
      );
    });

    it('PREMIUM_FLOW_CONTROL_CLARIFICATION_MESSAGE menciona cancelar/continuar', () => {
      expect(PREMIUM_FLOW_CONTROL_CLARIFICATION_MESSAGE).toContain(
        'cancelar pedido',
      );
      expect(PREMIUM_FLOW_CONTROL_CLARIFICATION_MESSAGE).toContain(
        'continuar pedido',
      );
    });

    it('PREMIUM_ORDER_NUDGE_MESSAGE pede quantidade+produto', () => {
      expect(PREMIUM_ORDER_NUDGE_MESSAGE).toContain('quantidade + produto');
    });

    it('PREMIUM_CONTEXT_RECOVERY_MESSAGE informa que nao ha pedido em andamento', () => {
      expect(PREMIUM_CONTEXT_RECOVERY_MESSAGE).toContain(
        'pedido em andamento',
      );
    });
  });

  describe('buildPremiumBoundaryMessage', () => {
    it('tom suave quando abuseCount=0', () => {
      const msg = buildPremiumBoundaryMessage(0);
      expect(msg).toContain('te ajudar melhor');
    });

    it('tom intermediario quando abuseCount=1', () => {
      const msg = buildPremiumBoundaryMessage(1);
      expect(msg).toContain('respeitosa');
      expect(msg).not.toMatch(/Eu nao vou seguir/);
    });

    it('tom firme quando abuseCount>=2', () => {
      const msg = buildPremiumBoundaryMessage(2);
      expect(msg).toContain('Eu nao vou seguir nesse tom');
    });

    it('default param sem argumento = 0', () => {
      expect(buildPremiumBoundaryMessage()).toBe(buildPremiumBoundaryMessage(0));
    });
  });
});
