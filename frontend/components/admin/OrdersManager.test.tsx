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
    updatingOrderId: null,
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
