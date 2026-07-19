import { describe, it, expect } from 'vitest';
import {
  getNextStatuses,
  getStatusMeta,
  getTimelineIndex,
  isTerminalStatus,
  TIMELINE_SEQUENCE,
  ORDER_STATUS_META,
} from './order-status';
import type { OrderStatus } from './types/order';

describe('order-status (espelha state machine do backend)', () => {
  it('todos os status tem metadados', () => {
    const all: OrderStatus[] = [
      'pendente_pagamento',
      'confirmado',
      'em_producao',
      'pronto',
      'em_transito',
      'entregue',
      'cancelado',
    ];
    for (const s of all) {
      expect(ORDER_STATUS_META[s]).toBeDefined();
      expect(getStatusMeta(s).label.length).toBeGreaterThan(0);
    }
  });

  describe('getNextStatuses — transicoes validas (igual ao backend)', () => {
    it('pendente_pagamento -> so cancelado (admin nao confirma pagamento)', () => {
      expect(getNextStatuses('pendente_pagamento')).toEqual(['cancelado']);
    });
    it('confirmado -> em_producao/cancelado', () => {
      expect(getNextStatuses('confirmado').sort()).toEqual(
        ['cancelado', 'em_producao'].sort(),
      );
    });
    it('em_producao -> pronto/cancelado', () => {
      expect(getNextStatuses('em_producao').sort()).toEqual(
        ['cancelado', 'pronto'].sort(),
      );
    });
    it('pronto -> em_transito/entregue (sem cancelar)', () => {
      expect(getNextStatuses('pronto').sort()).toEqual(
        ['em_transito', 'entregue'].sort(),
      );
    });
    it('em_transito -> entregue', () => {
      expect(getNextStatuses('em_transito')).toEqual(['entregue']);
    });
    it('entregue e cancelado sao terminais (sem proximos)', () => {
      expect(getNextStatuses('entregue')).toEqual([]);
      expect(getNextStatuses('cancelado')).toEqual([]);
    });

    // 🔒 Regressao de politica: o backend passou a impor transicoes POR ATOR
    // (order-status-transitions.ts). O painel chama PATCH /orders/:id/status,
    // que fixa actor='admin', e a politica do admin NAO inclui
    // pendente_pagamento -> confirmado ("so o pagamento real confirma").
    // Oferecer o botao aqui produzia um 400 na cara da lojista.
    it('🔒 admin NUNCA marca pago: pendente_pagamento nao oferece confirmado', () => {
      expect(getNextStatuses('pendente_pagamento')).not.toContain('confirmado');
    });
  });

  describe('timeline', () => {
    it('a sequencia da timeline nao inclui cancelado', () => {
      expect(TIMELINE_SEQUENCE).not.toContain('cancelado');
      expect(TIMELINE_SEQUENCE[0]).toBe('pendente_pagamento');
      expect(TIMELINE_SEQUENCE[TIMELINE_SEQUENCE.length - 1]).toBe('entregue');
    });
    it('getTimelineIndex localiza o status na jornada', () => {
      expect(getTimelineIndex('pendente_pagamento')).toBe(0);
      expect(getTimelineIndex('entregue')).toBe(5);
      expect(getTimelineIndex('cancelado')).toBe(-1);
    });
  });

  describe('isTerminalStatus', () => {
    it('entregue e cancelado sao terminais', () => {
      expect(isTerminalStatus('entregue')).toBe(true);
      expect(isTerminalStatus('cancelado')).toBe(true);
    });
    it('os demais nao sao terminais', () => {
      expect(isTerminalStatus('em_producao')).toBe(false);
      expect(isTerminalStatus('pronto')).toBe(false);
    });
  });
});
