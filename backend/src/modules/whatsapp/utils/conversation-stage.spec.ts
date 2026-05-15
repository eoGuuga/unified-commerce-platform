import { CustomerData } from '../types/whatsapp.types';
import {
  buildCollectionStageDetourMessage,
  getCollectionStageHint,
  getCollectionStageRequirement,
  getConversationStageLabel,
} from './conversation-stage';

describe('conversation-stage utils', () => {
  describe('getConversationStageLabel', () => {
    it('labels para estados de coleta', () => {
      expect(getConversationStageLabel('collecting_order')).toBe(
        'Montando o pedido',
      );
      expect(getConversationStageLabel('collecting_name')).toBe(
        'Coletando o nome do cliente',
      );
      expect(getConversationStageLabel('collecting_phone')).toBe(
        'Coletando o telefone de contato',
      );
      expect(getConversationStageLabel('collecting_notes')).toBe(
        'Coletando observacoes finais',
      );
      expect(getConversationStageLabel('collecting_cash_change')).toBe(
        'Coletando informacao de troco',
      );
    });

    it('label de address depende de delivery_type ja conhecido', () => {
      expect(
        getConversationStageLabel('collecting_address', {
          delivery_type: 'delivery',
        } as CustomerData),
      ).toBe('Coletando o endereco de entrega');

      expect(getConversationStageLabel('collecting_address')).toBe(
        'Escolhendo entrega ou retirada',
      );
    });

    it('labels para estados finais', () => {
      expect(getConversationStageLabel('confirming_order')).toBe(
        'Revisando o pedido antes de fechar',
      );
      expect(getConversationStageLabel('waiting_payment')).toBe(
        'Aguardando pagamento',
      );
      expect(getConversationStageLabel('order_confirmed')).toBe(
        'Pedido confirmado',
      );
      expect(getConversationStageLabel('order_completed')).toBe(
        'Pedido concluido',
      );
    });

    it('fallback "Conversa aberta" para undefined', () => {
      expect(getConversationStageLabel(undefined)).toBe('Conversa aberta');
    });
  });

  describe('getCollectionStageRequirement', () => {
    it('coletando_name -> pede nome completo', () => {
      expect(getCollectionStageRequirement('collecting_name')).toContain(
        'nome completo',
      );
    });

    it('coletando_address com delivery_type=delivery pede endereco', () => {
      expect(
        getCollectionStageRequirement('collecting_address', {
          delivery_type: 'delivery',
        } as CustomerData),
      ).toContain('endereco de entrega');
    });

    it('coletando_address sem delivery_type pergunta entrega/retirada', () => {
      expect(getCollectionStageRequirement('collecting_address')).toContain(
        'entrega ou retirada',
      );
    });

    it('coletando_phone pede DDD', () => {
      expect(getCollectionStageRequirement('collecting_phone')).toContain(
        'DDD',
      );
    });

    it('fallback generico', () => {
      expect(
        getCollectionStageRequirement('confirming_order'),
      ).toContain('etapa atual');
    });
  });

  describe('getCollectionStageHint', () => {
    it('hint do nome menciona exemplo', () => {
      expect(getCollectionStageHint('collecting_name')).toContain('Jordan');
    });

    it('hint de address pede rua/numero quando delivery', () => {
      expect(
        getCollectionStageHint('collecting_address', {
          delivery_type: 'delivery',
        } as CustomerData),
      ).toContain('rua');
    });

    it('hint de address pede entrega/retirada quando sem delivery_type', () => {
      expect(getCollectionStageHint('collecting_address')).toContain(
        'entrega',
      );
      expect(getCollectionStageHint('collecting_address')).toContain(
        'retirada',
      );
    });

    it('hint de phone tem exemplo numerico', () => {
      expect(getCollectionStageHint('collecting_phone')).toContain(
        '11987654321',
      );
    });
  });

  describe('buildCollectionStageDetourMessage', () => {
    it('combina intro + extras + requirement + hint', () => {
      const msg = buildCollectionStageDetourMessage(
        'Achei legal essa duvida.',
        'collecting_phone',
        undefined,
        ['Vou guardar pra responder ja ja.'],
      );

      expect(msg).toContain('Achei legal essa duvida.');
      expect(msg).toContain('Vou guardar pra responder ja ja.');
      expect(msg).toContain('preciso do telefone de contato com DDD');
      expect(msg).toContain('11987654321');
    });

    it('descarta linhas vazias', () => {
      const msg = buildCollectionStageDetourMessage(
        '',
        'collecting_phone',
      );
      // intro vazio + extras default vazios = nao aparecem linhas em branco
      expect(msg.startsWith('\n')).toBe(false);
    });
  });
});
