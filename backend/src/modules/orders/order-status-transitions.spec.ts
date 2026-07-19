import { BadRequestException } from '@nestjs/common';
import { PedidoStatus } from '../../database/entities/Pedido.entity';
import {
  isStatusTransitionAllowed,
  assertStatusTransition,
} from './order-status-transitions';

const S = PedidoStatus;
const ALL: PedidoStatus[] = [
  S.PENDENTE_PAGAMENTO,
  S.CONFIRMADO,
  S.EM_PRODUCAO,
  S.PRONTO,
  S.EM_TRANSITO,
  S.ENTREGUE,
  S.CANCELADO,
];

describe('Política de transição de status de pedido (por ator)', () => {
  describe('payment (webhook Asaas / confirmação PIX) — só confirma', () => {
    it('PENDENTE → CONFIRMADO permitido (a ÚNICA forma de marcar pago)', () => {
      expect(isStatusTransitionAllowed(S.PENDENTE_PAGAMENTO, S.CONFIRMADO, 'payment')).toBe(true);
    });
    it('não faz mais nada (ex.: CONFIRMADO → EM_PRODUCAO negado ao payment)', () => {
      expect(isStatusTransitionAllowed(S.CONFIRMADO, S.EM_PRODUCAO, 'payment')).toBe(false);
    });
  });

  describe('admin (mãe, JWT) — avança, cancela pré-pronto, NUNCA marca pago, não reverte', () => {
    it('avança: CONFIRMADO→EM_PRODUCAO, EM_PRODUCAO→PRONTO, PRONTO→ENTREGUE', () => {
      expect(isStatusTransitionAllowed(S.CONFIRMADO, S.EM_PRODUCAO, 'admin')).toBe(true);
      expect(isStatusTransitionAllowed(S.EM_PRODUCAO, S.PRONTO, 'admin')).toBe(true);
      expect(isStatusTransitionAllowed(S.PRONTO, S.ENTREGUE, 'admin')).toBe(true);
    });
    it('🔒 NUNCA marca pago: PENDENTE → CONFIRMADO negado pro admin', () => {
      expect(isStatusTransitionAllowed(S.PENDENTE_PAGAMENTO, S.CONFIRMADO, 'admin')).toBe(false);
    });
    it('🔒 não reverte: ENTREGUE→PENDENTE e CANCELADO→PENDENTE negados', () => {
      expect(isStatusTransitionAllowed(S.ENTREGUE, S.PENDENTE_PAGAMENTO, 'admin')).toBe(false);
      expect(isStatusTransitionAllowed(S.CANCELADO, S.PENDENTE_PAGAMENTO, 'admin')).toBe(false);
    });
    it('cancela até EM_PRODUCAO, mas NÃO depois de PRONTO', () => {
      expect(isStatusTransitionAllowed(S.EM_PRODUCAO, S.CANCELADO, 'admin')).toBe(true);
      expect(isStatusTransitionAllowed(S.PRONTO, S.CANCELADO, 'admin')).toBe(false);
    });
  });

  describe('customer (bot, por telefone) — só cancela o próprio, só pendente', () => {
    it('cancela pedido PENDENTE (não pago) permitido', () => {
      expect(isStatusTransitionAllowed(S.PENDENTE_PAGAMENTO, S.CANCELADO, 'customer')).toBe(true);
    });
    it('🔒 cancelar pedido PAGO/depois negado (escala pra mãe)', () => {
      expect(isStatusTransitionAllowed(S.CONFIRMADO, S.CANCELADO, 'customer')).toBe(false);
      expect(isStatusTransitionAllowed(S.EM_PRODUCAO, S.CANCELADO, 'customer')).toBe(false);
    });
    it('🔒 não faz nenhuma outra transição (ex.: PENDENTE→CONFIRMADO, CONFIRMADO→EM_PRODUCAO)', () => {
      expect(isStatusTransitionAllowed(S.PENDENTE_PAGAMENTO, S.CONFIRMADO, 'customer')).toBe(false);
      expect(isStatusTransitionAllowed(S.CONFIRMADO, S.EM_PRODUCAO, 'customer')).toBe(false);
    });
  });

  describe('🔒 trava crítica: →CONFIRMADO (pago) só por payment, de nenhum outro caminho', () => {
    it('admin e customer NUNCA alcançam CONFIRMADO, de estado nenhum (exceto o no-op já-CONFIRMADO)', () => {
      // Exclui from===CONFIRMADO: é o no-op idempotente (já pago segue pago), não
      // uma transição pra "marcar pago" — e nem chega ao assert no updateStatus.
      for (const from of ALL.filter((f) => f !== S.CONFIRMADO)) {
        expect(isStatusTransitionAllowed(from, S.CONFIRMADO, 'admin')).toBe(false);
        expect(isStatusTransitionAllowed(from, S.CONFIRMADO, 'customer')).toBe(false);
      }
    });
    it('payment só alcança CONFIRMADO a partir de PENDENTE (não de outros)', () => {
      expect(isStatusTransitionAllowed(S.PENDENTE_PAGAMENTO, S.CONFIRMADO, 'payment')).toBe(true);
      expect(isStatusTransitionAllowed(S.EM_PRODUCAO, S.CONFIRMADO, 'payment')).toBe(false);
      expect(isStatusTransitionAllowed(S.PRONTO, S.CONFIRMADO, 'payment')).toBe(false);
    });
  });

  describe('estados finais — ninguém sai deles', () => {
    it('ENTREGUE e CANCELADO são terminais pra todos os atores', () => {
      for (const actor of ['admin', 'customer', 'payment'] as const) {
        expect(isStatusTransitionAllowed(S.ENTREGUE, S.EM_TRANSITO, actor)).toBe(false);
        expect(isStatusTransitionAllowed(S.CANCELADO, S.PENDENTE_PAGAMENTO, actor)).toBe(false);
      }
    });
  });

  describe('assertStatusTransition — rejeita NÃO silenciosamente', () => {
    it('lança BadRequestException numa transição inválida', () => {
      expect(() => assertStatusTransition(S.ENTREGUE, S.PENDENTE_PAGAMENTO, 'admin')).toThrow(
        BadRequestException,
      );
    });
    it('não lança numa transição válida', () => {
      expect(() => assertStatusTransition(S.CONFIRMADO, S.EM_PRODUCAO, 'admin')).not.toThrow();
    });
  });
});
