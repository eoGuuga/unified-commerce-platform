import { BadRequestException } from '@nestjs/common';
import { PedidoStatus } from '../../database/entities/Pedido.entity';

/**
 * Quem está pedindo a mudança de status — derivado de COMO o chamador
 * autenticou, NUNCA de um parâmetro do request:
 *  - 'admin'    → painel da loja (a mãe), autenticado por JWT.
 *  - 'customer' → cliente via bot, identificado por telefone (Peça 3).
 *  - 'payment'  → fluxo de pagamento interno (webhook Asaas / confirmação PIX).
 *
 * O call-site fixa o ator como literal; o usuário final não consegue forjá-lo
 * (ele controla o status-alvo, não o ator).
 */
export type StatusActor = 'admin' | 'customer' | 'payment';

/**
 * Mapa de transições de status de pedido POR ATOR (política do dono).
 *
 * Invariantes que este mapa impõe:
 *  - 🔒 →CONFIRMADO ("pago") só existe para 'payment', e só de PENDENTE. Nem
 *    admin nem cliente marcam pago à mão — só o pagamento real confirma.
 *  - Cliente (bot) só CANCELA o próprio pedido, e só enquanto PENDENTE (não pago).
 *  - Admin avança o pedido e cancela até antes de PRONTO; nunca reverte.
 *  - ENTREGUE e CANCELADO são finais (sem entrada no mapa = nada permitido) para
 *    todos os atores.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<
  StatusActor,
  Partial<Record<PedidoStatus, PedidoStatus[]>>
> = {
  payment: {
    [PedidoStatus.PENDENTE_PAGAMENTO]: [PedidoStatus.CONFIRMADO],
  },
  admin: {
    [PedidoStatus.PENDENTE_PAGAMENTO]: [PedidoStatus.CANCELADO],
    [PedidoStatus.CONFIRMADO]: [PedidoStatus.EM_PRODUCAO, PedidoStatus.CANCELADO],
    [PedidoStatus.EM_PRODUCAO]: [PedidoStatus.PRONTO, PedidoStatus.CANCELADO],
    [PedidoStatus.PRONTO]: [PedidoStatus.EM_TRANSITO, PedidoStatus.ENTREGUE],
    [PedidoStatus.EM_TRANSITO]: [PedidoStatus.ENTREGUE],
  },
  customer: {
    [PedidoStatus.PENDENTE_PAGAMENTO]: [PedidoStatus.CANCELADO],
  },
};

/** True se `actor` pode mover um pedido de `from` para `to`. */
export function isStatusTransitionAllowed(
  from: PedidoStatus,
  to: PedidoStatus,
  actor: StatusActor,
): boolean {
  if (from === to) return true; // no-op idempotente (mesma transição não reprocessa)
  return (ALLOWED_STATUS_TRANSITIONS[actor]?.[from] ?? []).includes(to);
}

/**
 * Impõe a política: lança BadRequestException (erro claro, NÃO silencioso)
 * quando a transição não é permitida para o ator.
 */
export function assertStatusTransition(
  from: PedidoStatus,
  to: PedidoStatus,
  actor: StatusActor,
): void {
  if (!isStatusTransitionAllowed(from, to, actor)) {
    throw new BadRequestException(
      `Transição de status não permitida para ${actor}: ${from} → ${to}`,
    );
  }
}
