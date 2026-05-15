import { Pedido, PedidoStatus, CanalVenda } from '../../../database/entities/Pedido.entity';
import {
  StageRecoveryKind,
  buildClosedStageRecoveryMessage,
  buildPaymentStageGuardMessage,
  buildWaitingPaymentStageRecoveryMessage,
  getStageRecoveryLabel,
} from './stage-recovery';

const makePedido = (overrides: Partial<Pedido> = {}): Pedido =>
  ({
    id: 'p1',
    tenant_id: 't1',
    order_no: 'PED-0001',
    status: PedidoStatus.PENDENTE_PAGAMENTO,
    channel: CanalVenda.WHATSAPP,
    customer_name: 'Maria',
    subtotal: 100,
    discount_amount: 0,
    shipping_amount: 10,
    total_amount: 110,
    delivery_type: 'delivery',
    itens: [],
    created_at: new Date(),
    updated_at: new Date(),
    tenant: undefined as never,
    ...overrides,
  }) as unknown as Pedido;

describe('stage-recovery utils', () => {
  describe('getStageRecoveryLabel', () => {
    it('mapeia cada kind', () => {
      expect(getStageRecoveryLabel('phone')).toBe('telefone');
      expect(getStageRecoveryLabel('address')).toBe('endereco');
      expect(getStageRecoveryLabel('delivery')).toBe('forma de recebimento');
      expect(getStageRecoveryLabel('confirmation')).toBe('confirmacao final');
      expect(getStageRecoveryLabel('notes')).toBe('observacao');
      expect(getStageRecoveryLabel('name')).toBe('nome');
    });
  });

  describe('buildWaitingPaymentStageRecoveryMessage', () => {
    it('inclui order_no, status label e tracking URL quando ha pedido', () => {
      const pedido = makePedido();
      const msg = buildWaitingPaymentStageRecoveryMessage(
        pedido,
        'phone',
        'https://x.com/pedido?order=PED-0001',
      );
      expect(msg).toContain('PED-0001');
      expect(msg).toContain('Pagamento pendente');
      expect(msg).toContain('https://x.com/pedido?order=PED-0001');
      expect(msg).toContain('Nao preciso mais de telefone');
    });

    it('kind=confirmation usa intro especifico', () => {
      const msg = buildWaitingPaymentStageRecoveryMessage(
        makePedido(),
        'confirmation',
        '',
      );
      expect(msg).toContain('revisao final ja foi registrada');
    });

    it('sem pedido inclui fallback "Seu pedido ja esta aguardando..."', () => {
      const msg = buildWaitingPaymentStageRecoveryMessage(null, 'phone');
      expect(msg).toContain('aguardando a escolha do pagamento');
    });

    it('sempre lista pix e dinheiro como opcoes', () => {
      const msg = buildWaitingPaymentStageRecoveryMessage(null, 'phone');
      expect(msg).toContain('- pix');
      expect(msg).toContain('- dinheiro');
    });
  });

  describe('buildClosedStageRecoveryMessage', () => {
    it('order_completed -> menciona jornada concluida', () => {
      const msg = buildClosedStageRecoveryMessage(
        makePedido({ status: PedidoStatus.ENTREGUE }),
        'order_completed',
        'phone',
        'https://x.com/pedido?order=PED-0001',
      );
      expect(msg).toContain('concluiu a jornada');
      expect(msg).toContain('telefone');
    });

    it('order_confirmed -> menciona "em andamento"', () => {
      const msg = buildClosedStageRecoveryMessage(
        makePedido(),
        'order_confirmed',
        'address',
        'https://x.com/x',
      );
      expect(msg).toContain('em andamento');
      expect(msg).toContain('endereco');
    });

    it('sem pedido instrui usar "status do pedido"', () => {
      const msg = buildClosedStageRecoveryMessage(
        null,
        'order_completed',
        'phone',
      );
      expect(msg).toContain('status do pedido');
    });
  });

  describe('buildPaymentStageGuardMessage', () => {
    it('pedido cancelado -> mensagem de seguranca', () => {
      const msg = buildPaymentStageGuardMessage(
        makePedido({ status: PedidoStatus.CANCELADO }),
        'https://x.com/x',
      );
      expect(msg).toContain('cancelado');
      expect(msg).toContain('por seguranca');
      expect(msg).toContain('https://x.com/x');
    });

    it('pedido em andamento -> nao precisa pagar novamente', () => {
      const msg = buildPaymentStageGuardMessage(
        makePedido({ status: PedidoStatus.CONFIRMADO }),
        'https://x.com/x',
      );
      expect(msg).toContain('nao precisa ser escolhido novamente');
      expect(msg).toContain('Confirmado'); // status label
    });
  });

  describe('StageRecoveryKind exhaustiveness', () => {
    it('aceita todos os 6 kinds via getStageRecoveryLabel', () => {
      const kinds: StageRecoveryKind[] = [
        'phone',
        'address',
        'delivery',
        'confirmation',
        'notes',
        'name',
      ];
      for (const k of kinds) {
        expect(getStageRecoveryLabel(k)).toBeDefined();
        expect(getStageRecoveryLabel(k).length).toBeGreaterThan(0);
      }
    });
  });
});
