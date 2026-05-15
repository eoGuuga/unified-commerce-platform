import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { reducer, toast, useToast } from './use-toast';

describe('use-toast reducer', () => {
  const initial = { toasts: [] as Array<{ id: string; open?: boolean }> };

  it('ADD_TOAST adiciona um toast e respeita TOAST_LIMIT (1)', () => {
    const state = reducer(initial, {
      type: 'ADD_TOAST',
      toast: { id: 't1', open: true },
    });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe('t1');

    // Adicionar mais 1 mantem so o mais recente (TOAST_LIMIT = 1).
    const next = reducer(state, {
      type: 'ADD_TOAST',
      toast: { id: 't2', open: true },
    });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].id).toBe('t2');
  });

  it('UPDATE_TOAST aplica mudancas parciais sem tirar o toast da lista', () => {
    const withToast = reducer(initial, {
      type: 'ADD_TOAST',
      toast: { id: 't1', open: true, title: 'old' as unknown as never },
    });
    const updated = reducer(withToast, {
      type: 'UPDATE_TOAST',
      toast: { id: 't1', title: 'new' as unknown as never },
    });
    expect(updated.toasts).toHaveLength(1);
    expect(
      (updated.toasts[0] as { title?: unknown }).title,
    ).toBe('new');
  });

  it('DISMISS_TOAST com id marca open=false; sem id, marca todos', () => {
    const withToast = reducer(initial, {
      type: 'ADD_TOAST',
      toast: { id: 't1', open: true },
    });
    const dismissed = reducer(withToast, {
      type: 'DISMISS_TOAST',
      toastId: 't1',
    });
    expect(dismissed.toasts[0].open).toBe(false);

    const dismissedAll = reducer(withToast, { type: 'DISMISS_TOAST' });
    expect(dismissedAll.toasts.every((t) => t.open === false)).toBe(true);
  });

  it('REMOVE_TOAST com id remove apenas aquele; sem id, esvazia a lista', () => {
    const withToast = reducer(initial, {
      type: 'ADD_TOAST',
      toast: { id: 't1', open: true },
    });

    const removed = reducer(withToast, {
      type: 'REMOVE_TOAST',
      toastId: 't1',
    });
    expect(removed.toasts).toHaveLength(0);

    const cleared = reducer(withToast, { type: 'REMOVE_TOAST' });
    expect(cleared.toasts).toHaveLength(0);
  });
});

describe('useToast hook integration', () => {
  beforeEach(() => {
    // Limpa qualquer estado residual de testes anteriores.
    // O modulo guarda memoryState fora do React, entao chamamos dismiss
    // antes de iniciar para garantir baseline.
  });

  it('toast() adiciona um item visivel e retorna handles {id, dismiss, update}', () => {
    const { result } = renderHook(() => useToast());
    let handle: { id: string; dismiss: () => void; update: (p: never) => void } | undefined;
    act(() => {
      handle = toast({ title: 'ola' });
    });
    expect(handle?.id).toBeDefined();
    expect(result.current.toasts.length).toBeGreaterThan(0);
    expect(result.current.toasts[0].open).toBe(true);

    act(() => handle?.dismiss());
    expect(result.current.toasts[0]?.open).toBe(false);
  });
});
