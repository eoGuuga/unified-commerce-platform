import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/admin/shell/AdminDataProvider', () => ({
  useAdminData: vi.fn(),
}));

import { useAdminData } from '@/components/admin/shell/AdminDataProvider';
import { OrdersManager } from './OrdersManager';

const mockUseAdminData = useAdminData as ReturnType<typeof vi.fn>;

function makeData(over: Record<string, unknown> = {}) {
  return {
    orders: [],
    ordersLoading: false,
    ordersError: null,
    refetchOrders: vi.fn(),
    updateOrderStatus: vi.fn(),
    confirmOrderPayment: vi.fn(),
    updatingOrderId: null,
    ...over,
  };
}

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: 'ord-1',
    tenant_id: 'tnt-1',
    order_no: '1042',
    status: 'pendente_pagamento',
    channel: 'whatsapp',
    customer_name: 'Cliente Teste',
    total_amount: 47,
    created_at: '2026-07-19T12:00:00.000Z',
    ...over,
  };
}

describe('OrdersManager — D1: botão Atualizar mostra carregando', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sem carregar, o botão diz "Atualizar" e está habilitado', () => {
    mockUseAdminData.mockReturnValue(makeData());
    render(<OrdersManager />);

    const btn = screen.getByRole('button', { name: /^Atualizar$/i });
    expect(btn).not.toBeDisabled();
  });

  it('quando carregando, o botão vira "Atualizando…" e fica desabilitado', () => {
    mockUseAdminData.mockReturnValue(makeData({ ordersLoading: true }));
    render(<OrdersManager />);

    const btn = screen.getByRole('button', { name: /Atualizando/i });
    expect(btn).toBeDisabled();
  });
});

/**
 * Confirmacao MANUAL de pagamento (pagamento na entrega).
 *
 * A doceria aceita dinheiro/cartao na entrega pelo bot. Esses pedidos nascem
 * `pendente_pagamento`, e a politica por ator do backend
 * (order-status-transitions.ts) so deixa o ator `payment` mover pra
 * CONFIRMADO — nem admin nem cliente marcam pago a mao. O painel, portanto,
 * NAO tem (nem deve ter) botao "-> Confirmado".
 *
 * Sem uma via manual, o pedido pago em dinheiro fica ENCURRALADO: a lojista
 * so consegue CANCELAR. A via existe no backend (POST /payments/:id/confirm,
 * que confirma com ator `payment`) — estes testes amarram a UI a ela.
 */
describe('OrdersManager — confirmacao manual de pagamento (pago na entrega)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('🔒 pedido pendente_pagamento oferece "Confirmar pagamento" (senao fica so cancelavel)', () => {
    mockUseAdminData.mockReturnValue(makeData({ orders: [makeOrder()] }));
    render(<OrdersManager />);

    expect(screen.getByRole('button', { name: /Confirmar pagamento/i })).toBeTruthy();
  });

  it('nao oferece a confirmacao pra pedido que ja passou do pagamento', () => {
    mockUseAdminData.mockReturnValue(
      makeData({ orders: [makeOrder({ status: 'confirmado' })] }),
    );
    render(<OrdersManager />);

    expect(screen.queryByRole('button', { name: /Confirmar pagamento/i })).toBeNull();
  });

  it('clicar chama confirmOrderPayment com o pedido (a via de ator `payment`)', async () => {
    const confirmOrderPayment = vi.fn().mockResolvedValue({ ok: true });
    mockUseAdminData.mockReturnValue(
      makeData({ orders: [makeOrder()], confirmOrderPayment }),
    );
    render(<OrdersManager />);

    screen.getByRole('button', { name: /Confirmar pagamento/i }).click();

    expect(confirmOrderPayment).toHaveBeenCalledWith('ord-1');
  });
});
