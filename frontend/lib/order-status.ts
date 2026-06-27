import type { OrderStatus } from './types/order';

/**
 * Metadados de status de pedido — fonte unica reusada pelo /admin (gestao) e
 * pela pagina /pedido (acompanhamento do cliente).
 *
 * A ordem e as transicoes espelham a state machine do backend
 * (orders.service.ts `assertStatusTransition`). Manter em sincronia.
 */

export interface OrderStatusMeta {
  /** Rotulo amigavel para o cliente final. */
  label: string;
  /** Rotulo curto para o lojista (admin). */
  adminLabel: string;
  /** Descricao do que significa esse status. */
  description: string;
  /** Cor de destaque (tailwind-friendly hex) para badges. */
  tone: 'amber' | 'blue' | 'violet' | 'emerald' | 'slate' | 'red';
  /** Aparece na timeline de acompanhamento do cliente? (cancelado nao) */
  inTimeline: boolean;
}

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  pendente_pagamento: {
    label: 'Aguardando pagamento',
    adminLabel: 'Aguardando pagamento',
    description: 'Estamos aguardando a confirmação do seu pagamento.',
    tone: 'amber',
    inTimeline: true,
  },
  confirmado: {
    label: 'Pagamento confirmado',
    adminLabel: 'Confirmado',
    description: 'Pagamento confirmado! Seu pedido entrou na fila.',
    tone: 'blue',
    inTimeline: true,
  },
  em_producao: {
    label: 'Em preparação',
    adminLabel: 'Em produção',
    description: 'Seu pedido está sendo preparado com carinho.',
    tone: 'violet',
    inTimeline: true,
  },
  pronto: {
    label: 'Pronto',
    adminLabel: 'Pronto',
    description: 'Seu pedido está pronto!',
    tone: 'blue',
    inTimeline: true,
  },
  em_transito: {
    label: 'Saiu para entrega',
    adminLabel: 'Em trânsito',
    description: 'Seu pedido saiu para entrega e está a caminho.',
    tone: 'violet',
    inTimeline: true,
  },
  entregue: {
    label: 'Entregue',
    adminLabel: 'Entregue',
    description: 'Pedido entregue. Bom apetite! 🍫',
    tone: 'emerald',
    inTimeline: true,
  },
  cancelado: {
    label: 'Cancelado',
    adminLabel: 'Cancelado',
    description: 'Este pedido foi cancelado.',
    tone: 'red',
    inTimeline: false,
  },
};

/**
 * Sequencia "feliz" de status (para desenhar a timeline de acompanhamento).
 * Cancelado fica de fora — e um desvio, nao um passo da jornada.
 */
export const TIMELINE_SEQUENCE: OrderStatus[] = [
  'pendente_pagamento',
  'confirmado',
  'em_producao',
  'pronto',
  'em_transito',
  'entregue',
];

/**
 * Proximos status validos a partir do atual — espelha a state machine do backend.
 * Usado pelo admin para mostrar so os botoes de avanco permitidos.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pendente_pagamento: ['confirmado', 'cancelado'],
  confirmado: ['em_producao', 'cancelado'],
  em_producao: ['pronto', 'cancelado'],
  pronto: ['em_transito', 'entregue'],
  em_transito: ['entregue'],
  entregue: [],
  cancelado: [],
};

export function getNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export function getStatusMeta(status: OrderStatus): OrderStatusMeta {
  return ORDER_STATUS_META[status] ?? ORDER_STATUS_META.pendente_pagamento;
}

/** Indice do status na timeline (para marcar etapas concluidas). -1 se fora dela. */
export function getTimelineIndex(status: OrderStatus): number {
  return TIMELINE_SEQUENCE.indexOf(status);
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === 'entregue' || status === 'cancelado';
}
