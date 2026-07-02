'use client';

/**
 * useAvailabilityExceptions — hook de dados da seção "Exceções / Feriados" (Camada 2).
 *
 * Modelado no `useTenantSettings` (o repo NÃO usa react-query): useState/useEffect/
 * useCallback manual, fetch on mount (loading/error) e mutações com optimistic
 * update + rollback fiel no erro.
 *
 * Fetch on mount via `api.listExceptions()` (só as futuras, ordenadas pelo backend).
 *
 * `add(input)` / `remove(id)` / `closeToday()`:
 *  1. tira um SNAPSHOT da lista atual e aplica a mudança otimista no estado local;
 *  2. chama a API;
 *  3. no SUCESSO reflete o retorno canônico do servidor (merge da entity com id;
 *     upsert por data → substitui a linha da mesma data em vez de duplicar);
 *  4. no ERRO REVERTE ao snapshot exato anterior e retorna { ok:false, error }.
 *
 * A tela (T7) decide a UI; aqui só o dado + as mutações.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api-client';
import type {
  StoreException,
  CreateStoreExceptionInput,
} from '@/lib/types/store-exception';

export interface MutationResult {
  ok: boolean;
  error?: string;
}

export interface UseAvailabilityExceptionsResult {
  exceptions: StoreException[];
  loading: boolean;
  error: string | null;
  /** Cria/upserta uma exceção (optimistic + rollback no erro). */
  add: (input: CreateStoreExceptionInput) => Promise<MutationResult>;
  /** Remove uma exceção pelo id (optimistic + rollback no erro). */
  remove: (id: string) => Promise<MutationResult>;
  /** Fecha a loja hoje (upsert `closed` p/ hoje) (optimistic + rollback no erro). */
  closeToday: () => Promise<MutationResult>;
  refetch: () => Promise<void>;
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Insere/atualiza a exceção na lista mantendo o invariante de UMA linha por data
 * (upsert por data do backend) e a ordenação por data ascendente.
 */
function upsertByDate(
  list: StoreException[],
  exc: StoreException,
): StoreException[] {
  const withoutSameDate = list.filter((e) => e.date !== exc.date);
  return [...withoutSameDate, exc].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Placeholder otimista para uma criação: usa os dados do input; open/close viram
 * null quando não informados (ex.: `closed`). O id definitivo vem do servidor.
 */
function optimisticFromInput(input: CreateStoreExceptionInput): StoreException {
  return {
    id: `optimistic-${input.date}`,
    date: input.date,
    kind: input.kind,
    open: input.open ?? null,
    close: input.close ?? null,
  };
}

/**
 * Carrega e gerencia as exceções de disponibilidade do tenant autenticado.
 */
export function useAvailabilityExceptions(): UseAvailabilityExceptionsResult {
  const [exceptions, setExceptions] = useState<StoreException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listExceptions();
      setExceptions(data);
    } catch (err) {
      setError(messageOf(err, 'Não foi possível carregar as exceções.'));
      setExceptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExceptions();
  }, [fetchExceptions]);

  const add = useCallback(
    async (input: CreateStoreExceptionInput): Promise<MutationResult> => {
      // 1. Snapshot para rollback + optimistic (upsert por data).
      //    Captura do estado atual (padrão useTenantSettings), não de dentro do updater.
      const snapshot = exceptions;
      setExceptions(upsertByDate(snapshot, optimisticFromInput(input)));

      try {
        const created = await api.createException(input);
        // 2. Sucesso: refletir a entity canônica do servidor (id definitivo).
        setExceptions(upsertByDate(snapshot, created));
        return { ok: true };
      } catch (err) {
        // 3. Erro: reverter ao snapshot exato anterior.
        setExceptions(snapshot);
        return { ok: false, error: messageOf(err, 'Falha ao adicionar a exceção.') };
      }
    },
    [exceptions],
  );

  const remove = useCallback(
    async (id: string): Promise<MutationResult> => {
      // 1. Snapshot para rollback + optimistic (remove a linha).
      const snapshot = exceptions;
      setExceptions(snapshot.filter((e) => e.id !== id));

      try {
        await api.removeException(id);
        return { ok: true };
      } catch (err) {
        // 2. Erro: reverter ao snapshot exato anterior.
        setExceptions(snapshot);
        return { ok: false, error: messageOf(err, 'Falha ao remover a exceção.') };
      }
    },
    [exceptions],
  );

  const closeToday = useCallback(async (): Promise<MutationResult> => {
    // 1. Snapshot para rollback. Sem otimismo de linha (não sabemos a data "hoje"
    //    no fuso da loja aqui — o servidor é a verdade); refletimos o retorno.
    const snapshot = exceptions;

    try {
      const created = await api.closeToday();
      // 2. Sucesso: refletir a entity canônica do servidor (upsert por data).
      setExceptions(upsertByDate(snapshot, created));
      return { ok: true };
    } catch (err) {
      // 3. Erro: reverter ao snapshot exato anterior.
      setExceptions(snapshot);
      return { ok: false, error: messageOf(err, 'Falha ao fechar a loja hoje.') };
    }
  }, [exceptions]);

  return {
    exceptions,
    loading,
    error,
    add,
    remove,
    closeToday,
    refetch: fetchExceptions,
  };
}
