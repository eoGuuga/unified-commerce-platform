/**
 * Testa que o ModalAjuste bloqueia chamadas à API quando delta === 0,
 * exibindo mensagem amigável "Nenhuma mudança a registrar."
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocked antes do import do componente para sobrescrever o provider
const mockAdjustStock = vi.fn();

vi.mock('@/components/admin/shell/AdminDataProvider', () => ({
  useAdminData: () => ({
    adjustStock: mockAdjustStock,
    summary: null,
    stockLoading: false,
    stockError: null,
    refetchStock: vi.fn(),
    history: vi.fn(),
    setMin: vi.fn(),
    attentionCount: 0,
  }),
}));

// Importar depois do mock
import { StockManager } from '../StockManager';

// Produto de teste com current_stock = 10
const produtoTeste = {
  id: 'prod-1',
  name: 'Produto Teste',
  current_stock: 10,
  reserved_stock: 0,
  available_stock: 10,
  min_stock: 2,
};

// Injetar produto via mock do summary
vi.mock('@/components/admin/shell/AdminDataProvider', () => ({
  useAdminData: () => ({
    adjustStock: mockAdjustStock,
    summary: {
      total_products: 1,
      low_stock_count: 0,
      out_of_stock_count: 0,
      products: [produtoTeste],
    },
    stockLoading: false,
    stockError: null,
    refetchStock: vi.fn(),
    history: vi.fn().mockResolvedValue({ items: [] }),
    setMin: vi.fn(),
    attentionCount: 0,
  }),
}));

describe('ModalAjuste — delta=0 guard', () => {
  beforeEach(() => {
    mockAdjustStock.mockReset();
  });

  it('exibe "Nenhuma mudança a registrar." quando Correção com contado == estoque atual e NÃO chama adjustStock', async () => {
    render(<StockManager />);

    // Abrir modal de ajuste
    const btnAjustar = screen.getByTestId('btn-ajustar-prod-1');
    fireEvent.click(btnAjustar);

    // Selecionar tipo "Correção" (value = AJUSTE)
    const selectTipo = screen.getByRole('combobox');
    fireEvent.change(selectTipo, { target: { value: 'AJUSTE' } });

    // Digitar o valor contado igual ao estoque atual (delta = 0)
    const inputQtd = screen.getByRole('spinbutton');
    fireEvent.change(inputQtd, { target: { value: '10' } });

    // Submeter
    const btnConfirmar = screen.getByRole('button', { name: /confirmar/i });
    fireEvent.click(btnConfirmar);

    // Deve exibir mensagem amigável
    await waitFor(() => {
      expect(screen.getByTestId('erro-ajuste')).toHaveTextContent('Nenhuma mudança a registrar.');
    });

    // NÃO deve ter chamado a API
    expect(mockAdjustStock).not.toHaveBeenCalled();
  });
});
