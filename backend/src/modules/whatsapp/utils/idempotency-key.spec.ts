import { CustomerData, PendingOrder, TypedConversation } from '../types/whatsapp.types';
import { buildWhatsAppOrderIdempotencyKey } from './idempotency-key';

const makeConversation = (overrides: Partial<TypedConversation> = {}): TypedConversation =>
  ({
    id: 'conv-1',
    tenant_id: 'tenant-1',
    customer_phone: '5511987654321',
    state: 'collecting_order',
    context: {},
    ...overrides,
  }) as TypedConversation;

const makePendingOrder = (overrides: Partial<PendingOrder> = {}): PendingOrder =>
  ({
    items: [],
    total_amount: 100,
    ...overrides,
  }) as PendingOrder;

describe('idempotency-key', () => {
  describe('buildWhatsAppOrderIdempotencyKey', () => {
    it('comeca com "wa:<conversationId>:create_order:"', () => {
      const key = buildWhatsAppOrderIdempotencyKey(
        makeConversation(),
        makePendingOrder(),
      );
      expect(key.startsWith('wa:conv-1:create_order:')).toBe(true);
    });

    it('inclui hash sha256 (64 chars hex)', () => {
      const key = buildWhatsAppOrderIdempotencyKey(
        makeConversation(),
        makePendingOrder(),
      );
      const hash = key.split(':').pop()!;
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('deterministico para mesmos inputs', () => {
      const conv = makeConversation();
      const order = makePendingOrder();
      const customer: CustomerData = {
        name: 'Maria',
        phone: '5511987654321',
      };
      const a = buildWhatsAppOrderIdempotencyKey(conv, order, customer);
      const b = buildWhatsAppOrderIdempotencyKey(conv, order, customer);
      expect(a).toBe(b);
    });

    it('muda hash quando pendingOrder muda', () => {
      const conv = makeConversation();
      const a = buildWhatsAppOrderIdempotencyKey(
        conv,
        makePendingOrder({ total_amount: 100 }),
      );
      const b = buildWhatsAppOrderIdempotencyKey(
        conv,
        makePendingOrder({ total_amount: 200 }),
      );
      expect(a).not.toBe(b);
    });

    it('muda hash quando customerData muda', () => {
      const conv = makeConversation();
      const order = makePendingOrder();
      const a = buildWhatsAppOrderIdempotencyKey(conv, order, {
        name: 'Maria',
      } as CustomerData);
      const b = buildWhatsAppOrderIdempotencyKey(conv, order, {
        name: 'Joao',
      } as CustomerData);
      expect(a).not.toBe(b);
    });

    it('usa order_attempt_id quando presente', () => {
      const order = makePendingOrder();
      const a = buildWhatsAppOrderIdempotencyKey(
        makeConversation({
          context: { order_attempt_id: 'attempt-1' } as unknown as TypedConversation['context'],
        }),
        order,
      );
      const b = buildWhatsAppOrderIdempotencyKey(
        makeConversation({
          context: { order_attempt_id: 'attempt-2' } as unknown as TypedConversation['context'],
        }),
        order,
      );
      expect(a).not.toBe(b);
    });

    it('aceita customerData ausente (sem throw)', () => {
      expect(() =>
        buildWhatsAppOrderIdempotencyKey(makeConversation(), makePendingOrder()),
      ).not.toThrow();
    });
  });
});
