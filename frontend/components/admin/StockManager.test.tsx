/**
 * Testes do StockManager — leitura (T5a).
 *
 * Verifica:
 *  - filtro "Precisam de atenção" esconde produtos OK
 *  - badge por status usa classes corretas (stock-status.ts)
 *  - extrato renderiza linhas do history
 *  - estados de loading/erro/vazio
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// ---- Mock do AdminDataProvider ----

vi.mock('@/components/admin/shell/AdminDataProvider', () => ({
  useAdminData: vi.fn(),
}));

import { useAdminData } from '@/components/admin/shell/AdminDataProvider';
import { StockManager } from './StockManager';

const mockUseAdminData = useAdminData as ReturnType<typeof vi.fn>;

const summaryBase = {
  total_products: 3,
  low_stock_count: 1,
  out_of_stock_count: 1,
  products: [
    {
      id: 'p1',
      name: 'Produto OK',
      current_stock: 50,
      reserved_stock: 5,
      available_stock: 45,
      min_stock: 10,
      status: 'ok',
    },
    {
      id: 'p2',
      name: 'Produto Baixo',
      current_stock: 8,
      reserved_stock: 2,
      available_stock: 6,
      min_stock: 10,
      status: 'low',
    },
    {
      id: 'p3',
      name: 'Produto Esgotado',
      current_stock: 3,
      reserved_stock: 3,
      available_stock: 0,
      min_stock: 5,
      status: 'out',
    },
  ],
};

const historyItems = [
  {
    tipo: 'COMPRA',
    delta: 20,
    saldo_resultante: 50,
    motivo: 'Reposição mensal',
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    tipo: 'PERDA',
    delta: -3,
    saldo_resultante: 47,
    motivo: null,
    created_at: '2026-06-15T14:30:00Z',
  },
];

function makeAdminData(overrides = {}) {
  return {
    summary: summaryBase,
    stockLoading: false,
    stockError: null,
    refetchStock: vi.fn(),
    history: vi.fn().mockResolvedValue({ items: historyItems, total: 2 }),
    ...overrides,
  };
}

describe('StockManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminData.mockReturnValue(makeAdminData());
  });

  it('renderiza lista com todos os produtos por padrão', () => {
    render(<StockManager />);
    expect(screen.getByText('Produto OK')).toBeInTheDocument();
    expect(screen.getByText('Produto Baixo')).toBeInTheDocument();
    expect(screen.getByText('Produto Esgotado')).toBeInTheDocument();
  });

  it('filtro "Precisam de atenção" esconde produtos OK', async () => {
    render(<StockManager />);

    // Clica no filtro de atenção
    fireEvent.click(screen.getByText(/Precisam de atenção/));

    // Produto OK some
    expect(screen.queryByText('Produto OK')).not.toBeInTheDocument();

    // Low e out continuam
    expect(screen.getByText('Produto Baixo')).toBeInTheDocument();
    expect(screen.getByText('Produto Esgotado')).toBeInTheDocument();
  });

  it('badge "OK" tem classes emerald', () => {
    const { container } = render(<StockManager />);
    const badges = container.querySelectorAll('[class*="emerald"]');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('badge "Baixo" tem classes amber', () => {
    const { container } = render(<StockManager />);
    const badges = container.querySelectorAll('[class*="amber"]');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('badge "Esgotado" tem classes red', () => {
    const { container } = render(<StockManager />);
    const badges = container.querySelectorAll('[class*="red"]');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('estado de loading exibe mensagem de carregamento', () => {
    mockUseAdminData.mockReturnValue(makeAdminData({ summary: null, stockLoading: true }));
    render(<StockManager />);
    expect(screen.getByText(/carregando estoque/i)).toBeInTheDocument();
  });

  it('estado de erro exibe a mensagem e botão de retry', () => {
    mockUseAdminData.mockReturnValue(
      makeAdminData({ summary: null, stockError: 'Falha na conexão' }),
    );
    render(<StockManager />);
    expect(screen.getByText('Falha na conexão')).toBeInTheDocument();
    expect(screen.getByText(/tentar novamente/i)).toBeInTheDocument();
  });

  it('estado vazio exibe mensagem quando summary.products = []', () => {
    mockUseAdminData.mockReturnValue(
      makeAdminData({
        summary: { ...summaryBase, products: [] },
      }),
    );
    render(<StockManager />);
    expect(screen.getByText(/nenhum produto/i)).toBeInTheDocument();
  });

  it('clicar em Extrato chama history(productId) e renderiza os itens', async () => {
    const historyFn = vi.fn().mockResolvedValue({ items: historyItems, total: 2 });
    mockUseAdminData.mockReturnValue(makeAdminData({ history: historyFn }));

    render(<StockManager />);

    // Clica no primeiro botão de extrato (Produto OK)
    const botoesExtrato = screen.getAllByText('Extrato');
    fireEvent.click(botoesExtrato[0]);

    // Aguarda as linhas do extrato aparecerem
    await waitFor(() => {
      expect(screen.getByText('COMPRA')).toBeInTheDocument();
      expect(screen.getByText('PERDA')).toBeInTheDocument();
    });

    // Verifica delta positivo e negativo
    expect(screen.getByText('+20')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument();
  });

  it('drawer de extrato exibe motivo quando disponível', async () => {
    render(<StockManager />);

    const botoesExtrato = screen.getAllByText('Extrato');
    fireEvent.click(botoesExtrato[0]);

    await waitFor(() => {
      expect(screen.getByText(/Reposição mensal/)).toBeInTheDocument();
    });
  });

  it('extrato vazio exibe mensagem adequada', async () => {
    mockUseAdminData.mockReturnValue(
      makeAdminData({
        history: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      }),
    );

    render(<StockManager />);
    const botoesExtrato = screen.getAllByText('Extrato');
    fireEvent.click(botoesExtrato[0]);

    await waitFor(() => {
      expect(screen.getByText(/nenhuma movimentação/i)).toBeInTheDocument();
    });
  });
});
