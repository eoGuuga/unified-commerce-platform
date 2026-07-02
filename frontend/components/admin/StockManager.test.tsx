/**
 * Testes do StockManager — leitura (T5a) + mutações (T5b).
 *
 * T5a verifica:
 *  - filtro "Precisam de atenção" esconde produtos OK
 *  - badge por status usa classes corretas (stock-status.ts)
 *  - extrato renderiza linhas do history
 *  - estados de loading/erro/vazio
 *
 * T5b verifica:
 *  - modo-contagem: delta = contado - atual (contado=47, atual=50 → delta=-3)
 *  - modo-contagem: delta positivo (contado=55, atual=50 → delta=+5)
 *  - 422 INSUFFICIENT_STOCK → mensagem específica "Estoque insuficiente para esta saída"
 *  - ajuste OK fecha o modal
 *  - Correção usa delta bidirecional
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
import { API_ERROR_MESSAGES } from '@/lib/api-client';

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
    adjustStock: vi.fn().mockResolvedValue({ ok: true }),
    setMin: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe('StockManager — leitura (T5a)', () => {
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

  // B2 — erro do backend no extrato não pode vazar texto técnico cru na tela.
  it('B2: erro 500 no extrato mostra mensagem amigável, não o texto técnico cru', async () => {
    const historyFn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Internal server error'), { status: 500 }),
      );
    mockUseAdminData.mockReturnValue(makeAdminData({ history: historyFn }));

    render(<StockManager />);
    fireEvent.click(screen.getAllByText('Extrato')[0]);

    await waitFor(() => {
      expect(screen.getByText(API_ERROR_MESSAGES.server)).toBeInTheDocument();
    });
    expect(screen.queryByText(/internal server error/i)).not.toBeInTheDocument();
  });
});

// ---- Testes T5b: mutações ----

describe('StockManager — mutações (T5b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * T5b — Modo-contagem: contado=47, current=50 → delta no wire = -3.
   * Tipo Correção (AJUSTE) com valor contado na prateleira.
   */
  it('modo-contagem Correção: contado=47, atual=50 → adjustStock recebe delta=-3', async () => {
    const adjustStockFn = vi.fn().mockResolvedValue({ ok: true });
    mockUseAdminData.mockReturnValue(makeAdminData({ adjustStock: adjustStockFn }));

    render(<StockManager />);

    // Abre modal de ajuste para Produto OK (current_stock=50)
    const botoesAjustar = screen.getAllByText('Ajustar');
    fireEvent.click(botoesAjustar[0]);

    // Seleciona Correção
    const selectTipo = screen.getByRole('combobox');
    fireEvent.change(selectTipo, { target: { value: 'AJUSTE' } });

    // Insere valor contado = 47
    const inputQtd = screen.getByPlaceholderText(/quantas unidades há na prateleira/i);
    fireEvent.change(inputQtd, { target: { value: '47' } });

    // Confirma o delta preview: ajuste: -3
    expect(screen.getByTestId('delta-preview')).toHaveTextContent('ajuste: -3');

    // Submete
    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(adjustStockFn).toHaveBeenCalledWith('p1', 'AJUSTE', -3, undefined);
    });
  });

  /**
   * T5b — Modo-contagem bidirecional: contado=55, current=50 → delta=+5.
   */
  it('modo-contagem Correção: contado=55, atual=50 → adjustStock recebe delta=+5', async () => {
    const adjustStockFn = vi.fn().mockResolvedValue({ ok: true });
    mockUseAdminData.mockReturnValue(makeAdminData({ adjustStock: adjustStockFn }));

    render(<StockManager />);

    const botoesAjustar = screen.getAllByText('Ajustar');
    fireEvent.click(botoesAjustar[0]); // Produto OK (current=50)

    const selectTipo = screen.getByRole('combobox');
    fireEvent.change(selectTipo, { target: { value: 'AJUSTE' } });

    const inputQtd = screen.getByPlaceholderText(/quantas unidades há na prateleira/i);
    fireEvent.change(inputQtd, { target: { value: '55' } });

    // Confirma o delta preview: ajuste: +5
    expect(screen.getByTestId('delta-preview')).toHaveTextContent('ajuste: +5');

    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(adjustStockFn).toHaveBeenCalledWith('p1', 'AJUSTE', 5, undefined);
    });
  });

  /**
   * T5b — 422 INSUFFICIENT_STOCK → mensagem específica no UI.
   */
  it('422 INSUFFICIENT_STOCK → UI mostra "Estoque insuficiente para esta saída"', async () => {
    const adjustStockFn = vi
      .fn()
      .mockResolvedValue({ ok: false, code: 'INSUFFICIENT_STOCK', error: 'Estoque insuficiente' });

    mockUseAdminData.mockReturnValue(makeAdminData({ adjustStock: adjustStockFn }));

    render(<StockManager />);

    const botoesAjustar = screen.getAllByText('Ajustar');
    fireEvent.click(botoesAjustar[0]);

    // Seleciona Perda e insere quantidade
    const selectTipo = screen.getByRole('combobox');
    fireEvent.change(selectTipo, { target: { value: 'PERDA' } });

    const inputQtd = screen.getByPlaceholderText('0');
    fireEvent.change(inputQtd, { target: { value: '100' } });

    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Estoque insuficiente para esta saída.',
      );
    });
  });

  /**
   * T5b — Ajuste bem-sucedido fecha o modal.
   */
  it('ajuste OK fecha o modal', async () => {
    const adjustStockFn = vi.fn().mockResolvedValue({ ok: true });
    mockUseAdminData.mockReturnValue(makeAdminData({ adjustStock: adjustStockFn }));

    render(<StockManager />);

    const botoesAjustar = screen.getAllByText('Ajustar');
    fireEvent.click(botoesAjustar[0]);

    expect(screen.getByText('Ajustar Estoque')).toBeInTheDocument();

    const inputQtd = screen.getByPlaceholderText('0');
    fireEvent.change(inputQtd, { target: { value: '10' } });

    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(screen.queryByText('Ajustar Estoque')).not.toBeInTheDocument();
    });
  });

  /**
   * T5b — Perda: UI aplica delta negativo.
   */
  it('tipo Perda: quantidade=5 → adjustStock recebe delta=-5', async () => {
    const adjustStockFn = vi.fn().mockResolvedValue({ ok: true });
    mockUseAdminData.mockReturnValue(makeAdminData({ adjustStock: adjustStockFn }));

    render(<StockManager />);

    const botoesAjustar = screen.getAllByText('Ajustar');
    fireEvent.click(botoesAjustar[0]);

    const selectTipo = screen.getByRole('combobox');
    fireEvent.change(selectTipo, { target: { value: 'PERDA' } });

    const inputQtd = screen.getByPlaceholderText('0');
    fireEvent.change(inputQtd, { target: { value: '5' } });

    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(adjustStockFn).toHaveBeenCalledWith('p1', 'PERDA', -5, undefined);
    });
  });

  /**
   * T5b — Compra: quantidade positiva vai direto para o wire.
   */
  it('tipo Compra: quantidade=20 → adjustStock recebe delta=+20', async () => {
    const adjustStockFn = vi.fn().mockResolvedValue({ ok: true });
    mockUseAdminData.mockReturnValue(makeAdminData({ adjustStock: adjustStockFn }));

    render(<StockManager />);

    const botoesAjustar = screen.getAllByText('Ajustar');
    fireEvent.click(botoesAjustar[0]);

    // Compra é o tipo padrão — deixamos assim
    const inputQtd = screen.getByPlaceholderText('0');
    fireEvent.change(inputQtd, { target: { value: '20' } });

    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(adjustStockFn).toHaveBeenCalledWith('p1', 'COMPRA', 20, undefined);
    });
  });
});

// ---- Bloco 1 (polimento) — A1: reset do tipo entre produtos ----

describe('StockManager — A1: reset de tipo do ModalAjuste entre produtos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminData.mockReturnValue(makeAdminData());
  });

  it('abrir p/ produto A com "Perda", fechar, abrir p/ produto B → tipo volta ao default "Compra" (não persiste)', async () => {
    render(<StockManager />);

    // Abre o modal para o Produto A (primeiro "Ajustar") e muda o tipo para PERDA
    fireEvent.click(screen.getAllByText('Ajustar')[0]);
    const selectA = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(selectA, { target: { value: 'PERDA' } });
    expect(selectA.value).toBe('PERDA');

    // Fecha o modal
    fireEvent.click(screen.getByText('Cancelar'));
    await waitFor(() =>
      expect(screen.queryByText('Ajustar Estoque')).not.toBeInTheDocument(),
    );

    // Abre o modal para o Produto B (segundo "Ajustar")
    fireEvent.click(screen.getAllByText('Ajustar')[1]);
    const selectB = screen.getByRole('combobox') as HTMLSelectElement;

    // O tipo NÃO pode persistir "PERDA" — deve voltar ao default "COMPRA"
    expect(selectB.value).toBe('COMPRA');
  });
});

// ---- Bloco 2 (polimento) — A3: reabrir o extrato do mesmo produto ----

describe('StockManager — A3: fechar/reabrir o extrato não trava em loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abrir extrato -> fechar -> reabrir o MESMO produto recarrega (não fica em "Carregando…" eterno)', async () => {
    const historyFn = vi.fn().mockResolvedValue({ items: historyItems, total: 2 });
    mockUseAdminData.mockReturnValue(makeAdminData({ history: historyFn }));
    render(<StockManager />);

    // Abre o extrato do primeiro produto e vê os itens.
    fireEvent.click(screen.getAllByText('Extrato')[0]);
    await waitFor(() => expect(screen.getByText('COMPRA')).toBeInTheDocument());

    // Fecha o drawer.
    fireEvent.click(screen.getByLabelText('Fechar'));
    await waitFor(() =>
      expect(screen.queryByText('COMPRA')).not.toBeInTheDocument(),
    );

    // Reabre o MESMO produto: o drawer remonta, o efeito roda de novo -> recarrega.
    fireEvent.click(screen.getAllByText('Extrato')[0]);
    await waitFor(() => expect(screen.getByText('COMPRA')).toBeInTheDocument());
    expect(historyFn).toHaveBeenCalledTimes(2);
  });
});

// ---- Bloco 4 (polimento) — C3: feedback ao salvar o estoque mínimo ----

describe('StockManager — C3: feedback ao salvar o mínimo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('salvar o mínimo com sucesso mostra confirmação', async () => {
    const setMinFn = vi.fn().mockResolvedValue({ ok: true });
    mockUseAdminData.mockReturnValue(makeAdminData({ setMin: setMinFn }));
    render(<StockManager />);

    fireEvent.click(screen.getByTestId('editar-min-p1'));
    const input = screen.getByTestId('input-min-p1');
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByText(/salvo/i)).toBeInTheDocument());
    expect(setMinFn).toHaveBeenCalledWith('p1', 8);
  });

  it('falha ao salvar o mínimo mostra erro (antes o resultado era ignorado)', async () => {
    const setMinFn = vi.fn().mockResolvedValue({ ok: false, error: 'boom' });
    mockUseAdminData.mockReturnValue(makeAdminData({ setMin: setMinFn }));
    render(<StockManager />);

    fireEvent.click(screen.getByTestId('editar-min-p1'));
    const input = screen.getByTestId('input-min-p1');
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByText(/falhou/i)).toBeInTheDocument());
  });
});

// ---- Bloco 4 (polimento) — C4: ajuste valida antes de submeter ----

describe('StockManager — C4: ajuste valida a quantidade antes de submeter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminData.mockReturnValue(makeAdminData());
  });

  it('Confirmar desabilitado com quantidade vazia/0; habilita com valor válido', () => {
    render(<StockManager />);
    fireEvent.click(screen.getAllByText('Ajustar')[0]); // p1

    const confirmar = screen.getByRole('button', { name: /Confirmar/i });
    expect(confirmar).toBeDisabled(); // vazio

    const inputQtd = screen.getByPlaceholderText('0');
    fireEvent.change(inputQtd, { target: { value: '0' } });
    expect(confirmar).toBeDisabled();
    expect(screen.getByTestId('aviso-quantidade')).toBeInTheDocument();

    fireEvent.change(inputQtd, { target: { value: '5' } });
    expect(confirmar).not.toBeDisabled();
  });

  it('Correção com contado = estoque atual (delta 0) mantém Confirmar desabilitado', () => {
    render(<StockManager />);
    fireEvent.click(screen.getAllByText('Ajustar')[0]); // p1 (current 50)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'AJUSTE' } });
    const inputQtd = screen.getByPlaceholderText(/quantas unidades há na prateleira/i);
    fireEvent.change(inputQtd, { target: { value: '50' } }); // = current → delta 0

    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeDisabled();
    expect(screen.getByTestId('delta-preview')).toHaveTextContent('Nenhuma alteração');
  });
});

// ---- Bloco 4 (polimento) — D1: botão Atualizar com estado de carregando ----

describe('StockManager — D1: botão Atualizar mostra carregando', () => {
  it('quando carregando, o botão vira "Atualizando…" e fica desabilitado', () => {
    // summary presente + stockLoading true → lista renderiza + botão em loading.
    mockUseAdminData.mockReturnValue(makeAdminData({ stockLoading: true }));
    render(<StockManager />);

    const btn = screen.getByRole('button', { name: /Atualizando/i });
    expect(btn).toBeDisabled();
  });
});
