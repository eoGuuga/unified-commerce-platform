import { CustomerData } from '../types/whatsapp.types';
import {
  buildUnresolvedSupportNextStep,
  buildUnresolvedSupportRetryGuidance,
  getCollectionCorrectionPrompt,
  getCollectionRecapGuidance,
} from './collection-prompts';

describe('collection-prompts utils', () => {
  describe('getCollectionCorrectionPrompt', () => {
    it('coletando_name -> texto sobre nome', () => {
      expect(getCollectionCorrectionPrompt('collecting_name')).toContain(
        'nome completo',
      );
    });

    it('coletando_address com delivery_type -> texto pra reenviar endereco', () => {
      expect(
        getCollectionCorrectionPrompt('collecting_address', {
          delivery_type: 'delivery',
        } as CustomerData),
      ).toContain('endereco');
    });

    it('coletando_address sem delivery_type -> precisa alinhar entrega/retirada', () => {
      expect(getCollectionCorrectionPrompt('collecting_address')).toContain(
        'entrega ou retirada',
      );
    });

    it('coletando_phone -> reenviar telefone com DDD', () => {
      expect(getCollectionCorrectionPrompt('collecting_phone')).toContain(
        'DDD',
      );
    });

    it('coletando_cash_change -> exemplo de troco', () => {
      expect(
        getCollectionCorrectionPrompt('collecting_cash_change'),
      ).toContain('troco para 100');
    });

    it('confirming_order -> lista o que ajustar', () => {
      expect(getCollectionCorrectionPrompt('confirming_order')).toContain(
        'item',
      );
    });

    it('fallback', () => {
      expect(getCollectionCorrectionPrompt('order_completed')).toContain(
        'corrigir',
      );
    });
  });

  describe('getCollectionRecapGuidance', () => {
    it('cada etapa de coleta tem guidance proprio', () => {
      expect(getCollectionRecapGuidance('collecting_name')).toContain('nome');
      expect(getCollectionRecapGuidance('collecting_phone')).toContain(
        'DDD',
      );
      expect(getCollectionRecapGuidance('collecting_notes')).toContain(
        'observacao',
      );
    });

    it('coletando_address discrimina entrega vs sem delivery_type', () => {
      expect(
        getCollectionRecapGuidance('collecting_address', {
          delivery_type: 'delivery',
        } as CustomerData),
      ).toContain('endereco de entrega');
      expect(getCollectionRecapGuidance('collecting_address')).toContain(
        'entrega ou retirada',
      );
    });

    it('confirming_order pede "sim" ou "confirmar"', () => {
      const text = getCollectionRecapGuidance('confirming_order');
      expect(text).toContain('"sim"');
      expect(text).toContain('"confirmar"');
    });
  });

  describe('buildUnresolvedSupportNextStep', () => {
    it('coletando_name', () => {
      expect(buildUnresolvedSupportNextStep('collecting_name')).toContain(
        'nome',
      );
    });

    it('coletando_address discrimina por delivery_type', () => {
      expect(
        buildUnresolvedSupportNextStep('collecting_address', {
          delivery_type: 'delivery',
        } as CustomerData),
      ).toContain('endereco');

      expect(
        buildUnresolvedSupportNextStep('collecting_address'),
      ).toContain('entrega ou retirada');
    });

    it('waiting_payment menciona pix/dinheiro', () => {
      const text = buildUnresolvedSupportNextStep('waiting_payment');
      expect(text).toContain('pix');
      expect(text).toContain('dinheiro');
    });

    it('fallback com lastIntent="recommendation" cita "comparar"', () => {
      expect(
        buildUnresolvedSupportNextStep(undefined, undefined, 'recommendation'),
      ).toContain('comparar');
    });

    it('fallback sem lastIntent comercial', () => {
      expect(buildUnresolvedSupportNextStep(undefined)).toContain(
        'produto, pedido, pagamento ou entrega',
      );
    });
  });

  describe('buildUnresolvedSupportRetryGuidance', () => {
    it('waiting_payment menciona pix/pagamento', () => {
      const text = buildUnresolvedSupportRetryGuidance('waiting_payment');
      expect(text).toContain('pix');
      expect(text).toContain('paguei');
    });

    it('estados de coleta -> "ponto exato que travou"', () => {
      expect(
        buildUnresolvedSupportRetryGuidance('collecting_phone'),
      ).toContain('ponto exato que travou');
    });

    it('fallback generico', () => {
      expect(buildUnresolvedSupportRetryGuidance(undefined)).toContain(
        'ponto que ficou em aberto',
      );
    });
  });
});
