import {
  PREMIUM_ADDRESS_PROMPT,
  PREMIUM_CARD_PAYMENT_FALLBACK_MESSAGE,
  PREMIUM_NON_COMMERCIAL_RECOVERY_MESSAGE,
  PREMIUM_SOFT_RESET_MESSAGE,
  buildPremiumAddressDraftPrompt,
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
});
