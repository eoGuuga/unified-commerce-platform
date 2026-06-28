import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock do api-client antes de importar o hook
vi.mock('@/lib/api-client', () => ({
  default: {
    getProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  },
}));

import { useProducts } from './useProducts';
import api from '@/lib/api-client';

const apiMock = api as {
  getProducts: ReturnType<typeof vi.fn>;
  createProduct: ReturnType<typeof vi.fn>;
  updateProduct: ReturnType<typeof vi.fn>;
};

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getProducts.mockResolvedValue([
      { id: '1', name: 'Brigadeiro', price: 5, is_active: true },
      { id: '2', name: 'Trufa', price: 8, is_active: false },
    ]);
  });

  describe('getProducts — include_inactive', () => {
    it('chama getProducts com includeInactive:true para que inativos apareçam na lista', async () => {
      const { result } = renderHook(() => useProducts());
      await act(async () => { await Promise.resolve(); });

      // Verifica que o hook passou a flag ao api-client
      expect(apiMock.getProducts).toHaveBeenCalledWith('', { includeInactive: true });

      // Ambos os produtos (ativo + inativo) devem estar na lista
      expect(result.current.products).toHaveLength(2);
      expect(result.current.products.find((p) => p.id === '2')?.is_active).toBe(false);
    });

    it('filtro Inativos: produto inativo está na lista retornada pelo hook', async () => {
      const { result } = renderHook(() => useProducts());
      await act(async () => { await Promise.resolve(); });

      // Simula lógica do filtro "Inativos" do ProductsManager
      const inativos = result.current.products.filter((p) => !p.is_active);
      expect(inativos).toHaveLength(1);
      expect(inativos[0].name).toBe('Trufa');
    });

    it('filtro Todos: retorna ativo + inativo', async () => {
      const { result } = renderHook(() => useProducts());
      await act(async () => { await Promise.resolve(); });

      const todos = result.current.products;
      expect(todos).toHaveLength(2);
    });

    it('toggle de reativação: produto inativo pode ser reativado (não some da lista)', async () => {
      apiMock.updateProduct.mockResolvedValue({ id: '2', name: 'Trufa', price: 8, is_active: true });

      const { result } = renderHook(() => useProducts());
      await act(async () => { await Promise.resolve(); });

      // Produto inativo presente antes do toggle
      expect(result.current.products.find((p) => p.id === '2')?.is_active).toBe(false);

      await act(async () => {
        await result.current.toggleActive('2', true);
      });

      // Após reativação, produto permanece na lista com is_active=true
      const produto = result.current.products.find((p) => p.id === '2');
      expect(produto).toBeDefined();
      expect(produto?.is_active).toBe(true);
    });
  });

  describe('toggleActive — optimistic', () => {
    it('aplica is_active imediatamente antes da resposta da API', async () => {
      // Usar uma promise pendente para capturar o estado intermediário (optimistic)
      let resolveApi!: (v: unknown) => void;
      const apiPromise = new Promise((resolve) => { resolveApi = resolve; });
      apiMock.updateProduct.mockReturnValue(apiPromise);

      const { result } = renderHook(() => useProducts());

      // Esperar carregamento inicial
      await act(async () => { await Promise.resolve(); });
      expect(result.current.products[0].is_active).toBe(true);

      // Iniciar toggle sem aguardar conclusão
      act(() => { void result.current.toggleActive('1', false); });

      // Estado ANTES da resposta da API — já deve ter mudado (optimistic)
      expect(result.current.products[0].is_active).toBe(false);

      // Concluir a chamada da API
      await act(async () => {
        resolveApi({ id: '1', name: 'Brigadeiro', price: 5, is_active: false });
      });
    });

    it('reverte is_active quando a API retorna erro', async () => {
      apiMock.updateProduct.mockRejectedValue(new Error('timeout'));

      const { result } = renderHook(() => useProducts());
      await act(async () => { await Promise.resolve(); });

      expect(result.current.products[0].is_active).toBe(true);

      let toggleResult: { ok: boolean; error?: string };
      await act(async () => {
        toggleResult = await result.current.toggleActive('1', false);
      });

      // Deve ter revertido para true
      expect(result.current.products[0].is_active).toBe(true);
      // Deve retornar {ok:false}
      expect(toggleResult!.ok).toBe(false);
      expect(toggleResult!.error).toBe('timeout');
    });
  });

  describe('update — SKU nunca no payload', () => {
    it('não envia sku no payload de updateProduct', async () => {
      apiMock.updateProduct.mockResolvedValue({ id: '1', name: 'Novo Nome', price: 5, is_active: true });

      const { result } = renderHook(() => useProducts());
      await act(async () => { await Promise.resolve(); });

      await act(async () => {
        // Passar sku explicitamente — não deve chegar no mock
        await result.current.update('1', { name: 'Novo Nome', sku: 'sku-proibido' } as any);
      });

      expect(apiMock.updateProduct).toHaveBeenCalledWith(
        '1',
        expect.not.objectContaining({ sku: expect.anything() }),
        '',
      );
    });
  });
});
