/**
 * Testes do AdminDataProvider e useAdminData.
 *
 * Verifica:
 *  - useAdminData() fora do provider lança erro
 *  - provider não-fatal: erro de fetch de orders não propaga (children renderizam)
 *  - provider não-fatal: erro de fetch de stock → attentionCount undefined, children OK
 *  - pedidosCount conta apenas pedidos com status novo/pendente
 *  - attentionCount conta low+out do summary via stock-status.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { AdminDataProvider, useAdminData } from './AdminDataProvider';

// ---- Mock de useOrders ----

vi.mock('@/hooks/useOrders', () => ({
  useOrders: vi.fn(),
}));

// ---- Mock de useStock ----

vi.mock('@/hooks/useStock', () => ({
  useStock: vi.fn(),
}));

import { useOrders } from '@/hooks/useOrders';
import { useStock } from '@/hooks/useStock';

const mockUseOrders = useOrders as ReturnType<typeof vi.fn>;
const mockUseStock = useStock as ReturnType<typeof vi.fn>;

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

function makeUseStockReturn(overrides = {}) {
  return {
    summary: null,
    stockLoading: false,
    stockError: null,
    refetchStock: vi.fn(),
    attentionCount: undefined,
    history: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    adjustStock: vi.fn(),
    setMin: vi.fn(),
    ...overrides,
  };
}

// ---- Testes ----

describe('useAdminData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrders.mockReturnValue(makeUseOrdersReturn());
    mockUseStock.mockReturnValue(makeUseStockReturn());
  });

  it('lança erro quando usado fora do AdminDataProvider', () => {
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

  it('pedidosCount conta apenas pendente_pagamento e confirmado', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );
    const { result } = renderHook(() => useAdminData(), { wrapper });
    // 1 pendente_pagamento + 1 confirmado = 2
    expect(result.current.pedidosCount).toBe(2);
  });

  it('attentionCount conta low+out do summary via stock-status.ts', () => {
    // 2 low + 1 out = 3 em atenção; 1 ok não conta
    const summaryComAtencao = {
      total_products: 4,
      low_stock_count: 2,
      out_of_stock_count: 1,
      products: [
        { id: 'p1', name: 'A', current_stock: 5,  reserved_stock: 0, available_stock: 5,  min_stock: 2,  status: 'ok' },
        { id: 'p2', name: 'B', current_stock: 3,  reserved_stock: 1, available_stock: 2,  min_stock: 5,  status: 'low' },
        { id: 'p3', name: 'C', current_stock: 10, reserved_stock: 8, available_stock: 2,  min_stock: 10, status: 'low' },
        { id: 'p4', name: 'D', current_stock: 0,  reserved_stock: 0, available_stock: 0,  min_stock: 3,  status: 'out' },
      ],
    };

    mockUseStock.mockReturnValue(
      makeUseStockReturn({ summary: summaryComAtencao, attentionCount: 3 }),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );
    const { result } = renderHook(() => useAdminData(), { wrapper });
    expect(result.current.attentionCount).toBe(3);
    expect(result.current.summary).toEqual(summaryComAtencao);
  });
});

describe('AdminDataProvider — não-fatal em erro de fetch de orders', () => {
  beforeEach(() => {
    mockUseStock.mockReturnValue(makeUseStockReturn());
  });

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

    expect(screen.getByTestId('children-ok')).toBeInTheDocument();
  });

  it('expõe ordersError quando há erro de fetch de orders', () => {
    mockUseOrders.mockReturnValue(makeUseOrdersReturn({
      orders: [],
      error: 'Timeout de rede',
    }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );
    const { result } = renderHook(() => useAdminData(), { wrapper });
    expect(result.current.ordersError).toBe('Timeout de rede');
    expect(result.current.pedidosCount).toBe(0);
  });
});

describe('AdminDataProvider — stockError NÃO-FATAL (T5a)', () => {
  beforeEach(() => {
    mockUseOrders.mockReturnValue(makeUseOrdersReturn());
  });

  it('renderiza children quando useStock retorna erro', () => {
    mockUseStock.mockReturnValue(
      makeUseStockReturn({ stockError: 'Tenant sem estoque', attentionCount: undefined }),
    );

    render(
      <AdminDataProvider>
        <div data-testid="shell-vivo">Shell continua vivo</div>
      </AdminDataProvider>,
    );

    // A casca não é derrubada — children aparecem normalmente
    expect(screen.getByTestId('shell-vivo')).toBeInTheDocument();
  });

  it('attentionCount é undefined quando stock fetch falha — badge some', () => {
    mockUseStock.mockReturnValue(
      makeUseStockReturn({
        stockError: 'Erro 500 do servidor',
        attentionCount: undefined,
        summary: null,
      }),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminDataProvider>{children}</AdminDataProvider>
    );
    const { result } = renderHook(() => useAdminData(), { wrapper });

    // Badge some (undefined), stockError exposto, summary null
    expect(result.current.attentionCount).toBeUndefined();
    expect(result.current.stockError).toBe('Erro 500 do servidor');
    expect(result.current.summary).toBeNull();

    // Mas pedidos continuam funcionando
    expect(result.current.orders).toHaveLength(4);
    expect(result.current.pedidosCount).toBe(2);
  });

  it('stockError não propaga como throw — provider não explode', () => {
    mockUseStock.mockReturnValue(
      makeUseStockReturn({ stockError: 'Stock indisponível', attentionCount: undefined }),
    );

    // Não deve lançar
    expect(() => {
      render(
        <AdminDataProvider>
          <span>ok</span>
        </AdminDataProvider>,
      );
    }).not.toThrow();
  });
});
