/**
 * Testa que o ModalAjuste bloqueia chamadas à API quando delta === 0.
 * Após o C4 (Bloco 4), a validação é ANTES de submeter: o botão Confirmar
 * fica desabilitado quando não há mudança a registrar.
 */

import { render, screen, fireEvent } from '@testing-library/react';
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

  it('C4: Confirmar fica desabilitado quando Correção com contado == estoque atual (delta 0) e NÃO chama adjustStock', () => {
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

    // C4: valida ANTES de submeter — o botão fica desabilitado (nada a registrar),
    // em vez de só mostrar o erro depois de clicar em Confirmar.
    const btnConfirmar = screen.getByRole('button', { name: /confirmar/i });
    expect(btnConfirmar).toBeDisabled();
    expect(screen.getByTestId('delta-preview')).toHaveTextContent('Nenhuma alteração');

    // Clicar num botão desabilitado não dispara a API.
    fireEvent.click(btnConfirmar);
    expect(mockAdjustStock).not.toHaveBeenCalled();
  });
});
