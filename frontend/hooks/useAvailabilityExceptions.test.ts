import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock do api-client antes de importar o hook (mesmo padrao de useTenantSettings.test.ts).
// Mocka só o default (métodos HTTP), mantendo normalizeApiError real via importActual.
vi.mock('@/lib/api-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    default: {
      listExceptions: vi.fn(),
      createException: vi.fn(),
      removeException: vi.fn(),
      closeToday: vi.fn(),
    },
  };
});

import { useAvailabilityExceptions } from './useAvailabilityExceptions';
import api from '@/lib/api-client';
import type {
  StoreException,
  CreateStoreExceptionInput,
} from '@/lib/types/store-exception';

const apiMock = api as unknown as {
  listExceptions: ReturnType<typeof vi.fn>;
  createException: ReturnType<typeof vi.fn>;
  removeException: ReturnType<typeof vi.fn>;
  closeToday: ReturnType<typeof vi.fn>;
};

const excClosed: StoreException = {
  id: 'exc-1',
  date: '2026-07-10',
  kind: 'closed',
  open: null,
  close: null,
};

const excCustom: StoreException = {
  id: 'exc-2',
  date: '2026-07-15',
  kind: 'custom_hours',
  open: '09:00',
  close: '13:00',
};

// Clona a lista para cada teste (evita mutacao compartilhada entre casos).
function makeList(): StoreException[] {
  return JSON.parse(JSON.stringify([excClosed, excCustom])) as StoreException[];
}

describe('useAvailabilityExceptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.listExceptions.mockResolvedValue(makeList());
  });

  describe('fetch on mount', () => {
    it('popula exceptions e zera loading', async () => {
      const { result } = renderHook(() => useAvailabilityExceptions());

      // Antes do fetch resolver: loading true.
      expect(result.current.loading).toBe(true);

      await act(async () => {
        await Promise.resolve();
      });

      expect(apiMock.listExceptions).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.exceptions).toHaveLength(2);
      expect(result.current.exceptions[0].id).toBe('exc-1');
    });

    it('registra error e mantem exceptions vazio quando o fetch falha', async () => {
      apiMock.listExceptions.mockRejectedValueOnce(new Error('rede caiu'));

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.exceptions).toEqual([]);
      // B5: erro sem status vira o fallback amigável (não vaza o texto cru).
      expect(result.current.error).toBe('Não foi possível carregar as exceções.');
    });
  });

  describe('add — optimistic + rollback', () => {
    it('aplica a nova excecao no estado local ANTES da resposta da API (otimista)', async () => {
      // API pendente para capturar o estado intermediario.
      let resolveApi!: (v: StoreException) => void;
      const apiPromise = new Promise<StoreException>((resolve) => {
        resolveApi = resolve;
      });
      apiMock.createException.mockReturnValue(apiPromise);

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      const input: CreateStoreExceptionInput = { date: '2026-08-01', kind: 'closed' };

      // Dispara sem aguardar a API.
      act(() => {
        void result.current.add(input);
      });

      // Estado local ja contem a nova excecao (otimista), antes da resposta.
      expect(
        result.current.exceptions.some((e) => e.date === '2026-08-01'),
      ).toBe(true);

      const created: StoreException = {
        id: 'exc-new',
        date: '2026-08-01',
        kind: 'closed',
        open: null,
        close: null,
      };
      await act(async () => {
        resolveApi(created);
      });
    });

    it('chama apiClient.createException com o input e reflete o retorno do servidor no sucesso', async () => {
      const created: StoreException = {
        id: 'exc-server',
        date: '2026-08-01',
        kind: 'custom_hours',
        open: '10:00',
        close: '16:00',
      };
      apiMock.createException.mockResolvedValue(created);

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      const input: CreateStoreExceptionInput = {
        date: '2026-08-01',
        kind: 'custom_hours',
        open: '10:00',
        close: '16:00',
      };

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.add(input);
      });

      expect(apiMock.createException).toHaveBeenCalledWith(input);
      expect(res!.ok).toBe(true);
      // A excecao criada (com o id canonico do servidor) esta na lista.
      const persisted = result.current.exceptions.find((e) => e.id === 'exc-server');
      expect(persisted).toBeDefined();
      expect(persisted?.open).toBe('10:00');
    });

    it('no erro faz ROLLBACK ao snapshot anterior e retorna {ok:false}', async () => {
      apiMock.createException.mockRejectedValue(new Error('timeout'));

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      // Estado inicial conhecido: 2 excecoes.
      expect(result.current.exceptions).toHaveLength(2);

      const input: CreateStoreExceptionInput = { date: '2026-08-01', kind: 'closed' };

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.add(input);
      });

      // Reverteu ao snapshot anterior (a excecao otimista sumiu).
      expect(result.current.exceptions).toHaveLength(2);
      expect(
        result.current.exceptions.some((e) => e.date === '2026-08-01'),
      ).toBe(false);
      expect(res!.ok).toBe(false);
      expect(res!.error).toBe('Falha ao adicionar a exceção.');
    });

    it('upsert por data: add de uma data ja existente substitui, nao duplica', async () => {
      const updated: StoreException = {
        id: 'exc-1', // mesma linha (upsert no backend)
        date: '2026-07-10',
        kind: 'custom_hours',
        open: '08:00',
        close: '12:00',
      };
      apiMock.createException.mockResolvedValue(updated);

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      const input: CreateStoreExceptionInput = {
        date: '2026-07-10',
        kind: 'custom_hours',
        open: '08:00',
        close: '12:00',
      };
      await act(async () => {
        await result.current.add(input);
      });

      // Ainda sao 2 excecoes (a data 2026-07-10 foi substituida, nao duplicada).
      const forDate = result.current.exceptions.filter((e) => e.date === '2026-07-10');
      expect(forDate).toHaveLength(1);
      expect(forDate[0].kind).toBe('custom_hours');
      expect(forDate[0].open).toBe('08:00');
      expect(result.current.exceptions).toHaveLength(2);
    });
  });

  describe('remove — optimistic + rollback', () => {
    it('remove a linha do estado local ANTES da resposta da API (otimista)', async () => {
      let resolveApi!: () => void;
      const apiPromise = new Promise<void>((resolve) => {
        resolveApi = resolve;
      });
      apiMock.removeException.mockReturnValue(apiPromise);

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        void result.current.remove('exc-1');
      });

      // Sumiu na hora (otimista).
      expect(result.current.exceptions.some((e) => e.id === 'exc-1')).toBe(false);
      expect(result.current.exceptions).toHaveLength(1);

      await act(async () => {
        resolveApi();
      });
    });

    it('chama apiClient.removeException com o id e confirma no sucesso', async () => {
      apiMock.removeException.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.remove('exc-1');
      });

      expect(apiMock.removeException).toHaveBeenCalledWith('exc-1');
      expect(res!.ok).toBe(true);
      expect(result.current.exceptions.some((e) => e.id === 'exc-1')).toBe(false);
    });

    it('no erro faz ROLLBACK ao snapshot anterior e retorna {ok:false}', async () => {
      apiMock.removeException.mockRejectedValue(new Error('falhou'));

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.exceptions).toHaveLength(2);

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.remove('exc-1');
      });

      // A linha voltou (rollback).
      expect(result.current.exceptions).toHaveLength(2);
      expect(result.current.exceptions.some((e) => e.id === 'exc-1')).toBe(true);
      expect(res!.ok).toBe(false);
      expect(res!.error).toBe('Falha ao remover a exceção.');
    });
  });

  describe('closeToday', () => {
    it('chama o endpoint e a lista reflete a excecao de hoje', async () => {
      const todayExc: StoreException = {
        id: 'exc-today',
        date: '2026-07-01',
        kind: 'closed',
        open: null,
        close: null,
      };
      apiMock.closeToday.mockResolvedValue(todayExc);

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.closeToday();
      });

      expect(apiMock.closeToday).toHaveBeenCalledTimes(1);
      expect(res!.ok).toBe(true);
      expect(result.current.exceptions.some((e) => e.id === 'exc-today')).toBe(true);
    });

    it('no erro faz ROLLBACK e retorna {ok:false}', async () => {
      apiMock.closeToday.mockRejectedValue(new Error('sem rede'));

      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.exceptions).toHaveLength(2);

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.closeToday();
      });

      expect(result.current.exceptions).toHaveLength(2);
      expect(res!.ok).toBe(false);
      expect(res!.error).toBe('Falha ao fechar a loja hoje.');
    });
  });

  describe('refetch', () => {
    it('recarrega as excecoes do api-client', async () => {
      const { result } = renderHook(() => useAvailabilityExceptions());
      await act(async () => {
        await Promise.resolve();
      });

      const novo: StoreException[] = [excCustom];
      apiMock.listExceptions.mockResolvedValueOnce(novo);

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiMock.listExceptions).toHaveBeenCalledTimes(2);
      expect(result.current.exceptions).toHaveLength(1);
      expect(result.current.exceptions[0].id).toBe('exc-2');
    });
  });
});
