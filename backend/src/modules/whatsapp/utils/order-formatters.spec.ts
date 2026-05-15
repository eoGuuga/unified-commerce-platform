import { PedidoStatus, Pedido } from '../../../database/entities/Pedido.entity';
import {
  NOTES_PROMPT,
  PHONE_PROMPT,
  buildOrderItemsPreview,
  formatCurrencyBR,
  getDeliveryTypeLabel,
  getGreetingLine,
  getNextStepSummary,
  getOrderStatusAction,
  getStatusLabel,
} from './order-formatters';

const baseOrder = (overrides: Partial<Pedido> = {}): Pedido =>
  ({
    id: 'ord-1',
    tenant_id: 'tenant',
    order_no: 'PED-0001',
    status: PedidoStatus.PENDENTE_PAGAMENTO,
    channel: 'whatsapp' as Pedido['channel'],
    customer_name: 'Maria',
    customer_email: 'a@b.com',
    customer_phone: '11987654321',
    customer_notes: '',
    subtotal: 100,
    discount_amount: 0,
    shipping_amount: 10,
    coupon_code: undefined,
    total_amount: 110,
    delivery_type: 'delivery',
    delivery_address: undefined,
    seller_id: undefined,
    seller: undefined,
    tenant: undefined as never,
    itens: [],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }) as unknown as Pedido;

describe('order-formatters', () => {
  describe('formatCurrencyBR', () => {
    it('formata com 2 casas e virgula', () => {
      expect(formatCurrencyBR(10)).toBe('10,00');
      expect(formatCurrencyBR(99.9)).toBe('99,90');
      expect(formatCurrencyBR(1234.56)).toBe('1234,56');
    });

    it('aceita 0 e undefined-like', () => {
      expect(formatCurrencyBR(0)).toBe('0,00');
      expect(formatCurrencyBR(NaN)).toBe('0,00');
    });
  });

  describe('getGreetingLine', () => {
    it('usa o nome quando presente', () => {
      expect(getGreetingLine('Maria')).toBe('Ola, Maria!');
    });

    it('faz trim no nome', () => {
      expect(getGreetingLine('  Joao  ')).toBe('Ola, Joao!');
    });

    it('fallback "Ola!" para vazio/null/undefined', () => {
      expect(getGreetingLine(undefined)).toBe('Ola!');
      expect(getGreetingLine(null)).toBe('Ola!');
      expect(getGreetingLine('')).toBe('Ola!');
      expect(getGreetingLine('   ')).toBe('Ola!');
    });
  });

  describe('getStatusLabel', () => {
    it('traduz cada status conhecido', () => {
      expect(getStatusLabel(PedidoStatus.PENDENTE_PAGAMENTO)).toBe(
        'Pagamento pendente',
      );
      expect(getStatusLabel(PedidoStatus.CONFIRMADO)).toBe('Confirmado');
      expect(getStatusLabel(PedidoStatus.EM_PRODUCAO)).toBe('Em preparacao');
      expect(getStatusLabel(PedidoStatus.PRONTO)).toBe('Pronto');
      expect(getStatusLabel(PedidoStatus.EM_TRANSITO)).toBe('Em transito');
      expect(getStatusLabel(PedidoStatus.ENTREGUE)).toBe('Entregue');
      expect(getStatusLabel(PedidoStatus.CANCELADO)).toBe('Cancelado');
    });
  });

  describe('getDeliveryTypeLabel', () => {
    it('mapeia delivery -> Entrega', () => {
      expect(getDeliveryTypeLabel('delivery')).toBe('Entrega');
    });

    it('qualquer outro valor (pickup, undefined, null) -> Retirada', () => {
      expect(getDeliveryTypeLabel('pickup')).toBe('Retirada');
      expect(getDeliveryTypeLabel(undefined)).toBe('Retirada');
      expect(getDeliveryTypeLabel(null)).toBe('Retirada');
    });
  });

  describe('getNextStepSummary', () => {
    it('texto distinto para entrega vs retirada em PENDENTE_PAGAMENTO', () => {
      expect(
        getNextStepSummary(
          baseOrder({ delivery_type: 'delivery' }),
          PedidoStatus.PENDENTE_PAGAMENTO,
        ),
      ).toContain('entrega');
      expect(
        getNextStepSummary(
          baseOrder({ delivery_type: 'pickup' }),
          PedidoStatus.PENDENTE_PAGAMENTO,
        ),
      ).toContain('retirada');
    });

    it('retorna texto para ENTREGUE e CANCELADO', () => {
      expect(
        getNextStepSummary(baseOrder(), PedidoStatus.ENTREGUE),
      ).toContain('comprovante');
      expect(
        getNextStepSummary(baseOrder(), PedidoStatus.CANCELADO),
      ).toContain('retomar');
    });
  });

  describe('getOrderStatusAction', () => {
    it('sugere "pix" ou "dinheiro" em PENDENTE_PAGAMENTO', () => {
      const action = getOrderStatusAction(
        baseOrder(),
        PedidoStatus.PENDENTE_PAGAMENTO,
      );
      expect(action).toContain('pix');
      expect(action).toContain('dinheiro');
    });

    it('CONFIRMADO/EM_PRODUCAO/PRONTO/EM_TRANSITO -> "status do pedido"', () => {
      for (const status of [
        PedidoStatus.CONFIRMADO,
        PedidoStatus.EM_PRODUCAO,
        PedidoStatus.PRONTO,
        PedidoStatus.EM_TRANSITO,
      ]) {
        expect(getOrderStatusAction(baseOrder(), status)).toContain(
          'status do pedido',
        );
      }
    });

    it('ENTREGUE -> "repetir pedido"', () => {
      expect(getOrderStatusAction(baseOrder(), PedidoStatus.ENTREGUE)).toContain(
        'repetir pedido',
      );
    });

    it('CANCELADO -> "reabrir pedido"', () => {
      expect(getOrderStatusAction(baseOrder(), PedidoStatus.CANCELADO)).toContain(
        'reabrir pedido',
      );
    });
  });

  describe('buildOrderItemsPreview', () => {
    it('retorna string vazia quando sem itens', () => {
      expect(buildOrderItemsPreview(baseOrder({ itens: [] }))).toBe('');
    });

    it('lista ate 4 itens com quantidade e nome do produto', () => {
      const itens = [1, 2, 3, 4].map((n) => ({
        quantity: n,
        produto: { name: `P${n}` },
      })) as Pedido['itens'];
      const preview = buildOrderItemsPreview(baseOrder({ itens }));
      expect(preview).toContain('Itens:');
      expect(preview).toContain('- 1x P1');
      expect(preview).toContain('- 4x P4');
      expect(preview).not.toContain('mais');
    });

    it('adiciona "mais N item(ns)" quando passa de 4', () => {
      const itens = Array.from({ length: 7 }, (_, i) => ({
        quantity: 1,
        produto: { name: `P${i + 1}` },
      })) as Pedido['itens'];
      const preview = buildOrderItemsPreview(baseOrder({ itens }));
      expect(preview).toContain('- mais 3 item(ns)');
    });

    it('fallback para produto_id ou "Produto" quando nao ha nome', () => {
      const itens = [
        { quantity: 2, produto_id: 'prod-x' },
        { quantity: 1 },
      ] as Pedido['itens'];
      const preview = buildOrderItemsPreview(baseOrder({ itens }));
      expect(preview).toContain('- 2x prod-x');
      expect(preview).toContain('- 1x Produto');
    });
  });

  describe('prompts', () => {
    it('PHONE_PROMPT eh um texto orientando entrada de telefone', () => {
      expect(PHONE_PROMPT).toMatch(/telefone/i);
      expect(PHONE_PROMPT).toContain('(11) 98765-4321');
    });

    it('NOTES_PROMPT cobre observacao opcional', () => {
      expect(NOTES_PROMPT).toMatch(/observa/i);
      expect(NOTES_PROMPT).toContain('sem');
    });
  });
});
