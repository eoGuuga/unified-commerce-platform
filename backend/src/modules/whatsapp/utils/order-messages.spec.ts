import { MetodoPagamento } from '../../../database/entities/Pagamento.entity';
import { CanalVenda, Pedido, PedidoStatus } from '../../../database/entities/Pedido.entity';
import {
  buildOrderCreatedMessage,
  enrichPaymentMessage,
  getPremiumPaymentOptionsMessage,
} from './order-messages';

const makePedido = (overrides: Partial<Pedido> = {}): Pedido =>
  ({
    id: 'p1',
    tenant_id: 't1',
    order_no: 'PED-0001',
    status: PedidoStatus.PENDENTE_PAGAMENTO,
    channel: CanalVenda.WHATSAPP,
    customer_name: 'Maria',
    subtotal: 90,
    discount_amount: 0,
    shipping_amount: 10,
    total_amount: 100,
    delivery_type: 'delivery',
    itens: [],
    created_at: new Date(),
    updated_at: new Date(),
    tenant: undefined as never,
    ...overrides,
  }) as unknown as Pedido;

describe('order-messages utils', () => {
  describe('enrichPaymentMessage', () => {
    it('adiciona follow-up especifico para PIX', () => {
      const msg = enrichPaymentMessage(
        'Aqui esta seu QR Pix.',
        makePedido(),
        MetodoPagamento.PIX,
        'https://x.com/x',
      );
      expect(msg).toContain('Aqui esta seu QR Pix.');
      expect(msg).toContain('pagamento for reconhecido');
      expect(msg).toContain('https://x.com/x');
    });

    it('adiciona follow-up para DINHEIRO', () => {
      const msg = enrichPaymentMessage(
        'Pagamento em dinheiro confirmado.',
        makePedido(),
        MetodoPagamento.DINHEIRO,
        'https://x.com/x',
      );
      expect(msg).toContain('equipe confirmar o recebimento');
    });

    it('adiciona follow-up generico para outros metodos', () => {
      const msg = enrichPaymentMessage(
        'Pagamento iniciado.',
        makePedido(),
        MetodoPagamento.BOLETO,
        'https://x.com/x',
      );
      expect(msg).toContain('proxima atualizacao');
    });

    it('faz trim do baseMessage', () => {
      const msg = enrichPaymentMessage(
        '   trimmed   ',
        makePedido(),
        MetodoPagamento.PIX,
        '',
      );
      expect(msg.split('\n')[0]).toBe('trimmed');
    });
  });

  describe('getPremiumPaymentOptionsMessage', () => {
    it('mostra PIX com desconto de 5% calculado', () => {
      const msg = getPremiumPaymentOptionsMessage(100);
      expect(msg).toContain('PIX com 5% de desconto');
      expect(msg).toContain('R$ 95,00'); // 100 * 0.95 = 95
    });

    it('aceita zero (sem desconto valor 0)', () => {
      const msg = getPremiumPaymentOptionsMessage(0);
      expect(msg).toContain('R$ 0,00');
    });

    it('sempre inclui dinheiro como opcao 2', () => {
      const msg = getPremiumPaymentOptionsMessage(50);
      expect(msg).toContain('2. Dinheiro');
    });

    it('sempre instrui responder com numero ou nome', () => {
      const msg = getPremiumPaymentOptionsMessage(50);
      expect(msg).toContain('"1"');
      expect(msg).toContain('"pix"');
      expect(msg).toContain('"dinheiro"');
    });
  });

  describe('buildOrderCreatedMessage', () => {
    it('inclui saudacao com nome do cliente', () => {
      const msg = buildOrderCreatedMessage(
        makePedido({ customer_name: 'Joao' }),
        'https://x.com/x',
      );
      expect(msg).toContain('Ola, Joao!');
    });

    it('saudacao generica quando sem nome', () => {
      const msg = buildOrderCreatedMessage(
        makePedido({ customer_name: '' }),
        'https://x.com/x',
      );
      expect(msg.split('\n')[0]).toBe('Ola!');
    });

    it('inclui numero, recebimento, total e URL', () => {
      const msg = buildOrderCreatedMessage(
        makePedido({
          order_no: 'PED-9999',
          delivery_type: 'pickup',
          total_amount: 199.9,
        }),
        'https://app.x.com/pedido?order=PED-9999',
      );
      expect(msg).toContain('PED-9999');
      expect(msg).toContain('Retirada');
      expect(msg).toContain('R$ 199,90');
      expect(msg).toContain('https://app.x.com/pedido?order=PED-9999');
    });

    it('inclui texto "PEDIDO CRIADO COM SUCESSO"', () => {
      const msg = buildOrderCreatedMessage(makePedido(), '');
      expect(msg).toContain('PEDIDO CRIADO COM SUCESSO');
    });

    it('inclui as opcoes de pagamento premium (PIX desconto)', () => {
      const msg = buildOrderCreatedMessage(
        makePedido({ total_amount: 200 }),
        '',
      );
      expect(msg).toContain('FORMAS DE PAGAMENTO');
      expect(msg).toContain('R$ 190,00'); // 200 * 0.95
    });
  });
});
