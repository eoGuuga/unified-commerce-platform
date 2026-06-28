/**
 * Testes do AdminDataProvider e useAdminData.
 *
 * Verifica:
 *  - useAdminData() fora do provider lança erro
 *  - provider não fatal: erro de fetch não propaga (children renderizam)
 *  - pedidosCount conta apenas pedidos com status novo/pendente
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { AdminDataProvider, useAdminData } from './AdminDataProvider';

// ---- Mock de useOrders ----

vi.mock('@/hooks/useOrders', () => ({
  useOrders: vi.fn(),
}));

import { useOrders } from '@/hooks/useOrders';

const mockUseOrders = useOrders as ReturnType<typeof vi.fn>;

const defaultOrders = [
  { id: 'o1', status: 'pendente_pagamento', order_no: 'P001' },
  { id: 'o2', status: 'confirmado', order_no: 'P002' },
  { id: 'o3', status: 'entregue', order_no: 'P003' },
  { id: 'o4', status: 'cancelado', order_no: 'P004' },
];

function makeUseOrdersReturn(overrides = {}) {
  return {
    orders: defaultOrders,
    loading: false,
    error: null,
    refetch: vi.fn(),
    updateStatus: vi.fn(),
    updatingId: null,
    ...overrides,
  };
}

// ---- Testes ----

describe('useAdminData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrders.mockReturnValue(makeUseOrdersReturn());
  });

  it('lança erro quando usado fora do AdminDataProvider', () => {
    // Suprimir console.error do React para erros de renderização esperados
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAdminData());
    }).toThrow(/useAdminData\(\) deve ser usado dentro de/);

    spy.mockRestore();
  });

  it('retorna dados dentro do AdminDataProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );

    const { result } = renderHook(() => useAdminData(), { wrapper });
    expect(result.current.orders).toHaveLength(4);
    expect(result.current.ordersLoading).toBe(false);
    expect(result.current.ordersError).toBeNull();
  });

  it('pedidosCount conta apenas pedentes_pagamento e confirmado', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );

    const { result } = renderHook(() => useAdminData(), { wrapper });
    // defaultOrders tem 1 pendente_pagamento + 1 confirmado = 2
    expect(result.current.pedidosCount).toBe(2);
  });

  it('expõe stubs de estoque com os tipos corretos', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );

    const { result } = renderHook(() => useAdminData(), { wrapper });
    expect(result.current.summary).toBeNull();
    expect(result.current.stockLoading).toBe(false);
    expect(result.current.stockError).toBeNull();
    expect(result.current.attentionCount).toBeUndefined();
    expect(typeof result.current.history).toBe('function');
    expect(typeof result.current.adjustStock).toBe('function');
    expect(typeof result.current.setMin).toBe('function');
  });

  it('stub history retorna estrutura vazia', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );

    const { result } = renderHook(() => useAdminData(), { wrapper });
    const histResult = await result.current.history();
    expect(histResult).toEqual({ items: [], total: 0 });
  });
});

describe('AdminDataProvider — não-fatal em erro de fetch', () => {
  it('renderiza children mesmo quando useOrders retorna erro', () => {
    mockUseOrders.mockReturnValue(makeUseOrdersReturn({
      orders: [],
      error: 'Falha de rede simulada',
    }));

    render(
      <AdminDataProvider>
        <div data-testid="children-ok">Conteúdo da página</div>
      </AdminDataProvider>,
    );

    // Children devem aparecer mesmo com erro
    expect(screen.getByTestId('children-ok')).toBeInTheDocument();
  });

  it('expõe ordersError quando há erro de fetch', () => {
    mockUseOrders.mockReturnValue(makeUseOrdersReturn({
      orders: [],
      error: 'Timeout de rede',
    }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );

    const { result } = renderHook(() => useAdminData(), { wrapper });
    expect(result.current.ordersError).toBe('Timeout de rede');
    // pedidosCount deve ser 0 quando não há pedidos
    expect(result.current.pedidosCount).toBe(0);
  });
});
