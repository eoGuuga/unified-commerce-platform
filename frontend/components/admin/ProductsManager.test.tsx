import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// useProducts é mockado (estado estável, sem rede). O api real é mantido para
// que normalizeApiError seja o de verdade; só espionamos api.getCategories.
const mockUseProducts = vi.fn();
vi.mock('@/hooks/useProducts', () => ({
  useProducts: () => mockUseProducts(),
}));

import { ProductsManager } from './ProductsManager';
import api from '@/lib/api-client';

function makeProductsState(over: Record<string, unknown> = {}) {
  return {
    products: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggleActive: vi.fn(),
    mutatingId: null,
    ...over,
  };
}

describe('ProductsManager — B3 (categorias não podem falhar em silêncio)', () => {
  beforeEach(() => {
    mockUseProducts.mockReturnValue(makeProductsState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('B3: falha ao carregar categorias mostra aviso (não engole o erro)', async () => {
    vi.spyOn(api, 'getCategories').mockRejectedValue(new Error('boom'));

    render(<ProductsManager />);

    expect(
      await screen.findByText(/não foi possível carregar as categorias/i),
    ).toBeInTheDocument();
  });

  it('B3: quando as categorias carregam, nenhum aviso é exibido', async () => {
    vi.spyOn(api, 'getCategories').mockResolvedValue(['Doces', 'Salgados']);

    render(<ProductsManager />);

    // Header sempre presente — garante que o efeito já resolveu.
    await screen.findByText('Produtos');
    expect(
      screen.queryByText(/não foi possível carregar as categorias/i),
    ).not.toBeInTheDocument();
  });
});

describe('ProductsManager — D1: estados de carregando nos botões', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getCategories').mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('botão Atualizar vira "Atualizando…" e desabilita quando loading', () => {
    mockUseProducts.mockReturnValue(makeProductsState({ loading: true }));
    render(<ProductsManager />);

    expect(screen.getByRole('button', { name: /Atualizando/i })).toBeDisabled();
  });

  it('toggle Ativar/Desativar mostra "Salvando…" e desabilita durante a mutação', () => {
    mockUseProducts.mockReturnValue(
      makeProductsState({
        products: [
          {
            id: '1',
            tenant_id: 't1',
            name: 'Brigadeiro',
            price: 5,
            unit: 'unidade',
            is_active: true,
          },
        ],
        mutatingId: '1',
      }),
    );
    render(<ProductsManager />);

    expect(screen.getByRole('button', { name: /Salvando/i })).toBeDisabled();
  });
});
