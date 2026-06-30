'use client';

import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import type { PdvCartItem } from '@/lib/pdv/cart';

export interface PdvCartProps {
  items: PdvCartItem[];
  total: number;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
  /** A página passa `items.length === 0`. */
  payDisabled: boolean;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function PdvCart({
  items,
  total,
  onInc,
  onDec,
  onRemove,
  onClear,
  onPay,
  payDisabled,
}: PdvCartProps) {
  const isEmpty = items.length === 0;

  function handleClear() {
    if (isEmpty) return;
    // Confirmação simples (v1): evita descartar uma venda começada por engano.
    if (window.confirm('Descartar esta venda? Os itens do carrinho serão removidos.')) {
      onClear();
    }
  }

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-5 text-slate-500" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
            Carrinho
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="size-3.5" />
          Limpar
        </button>
      </div>

      {/* Lista rola; o rodapé (total + PAGAR) fica fixo. */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isEmpty ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
              <ShoppingCart className="size-6" />
            </div>
            <p className="text-sm font-medium text-slate-500">
              Carrinho vazio — busque um produto
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const subtotal = item.unit_price * item.quantity;
              return (
                <li
                  key={item.produto_id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        data-testid="pdv-cart-item-name"
                        className="truncate text-sm font-semibold text-slate-900"
                      >
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {currencyFormatter.format(item.unit_price)} / un
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.produto_id)}
                      aria-label={`Remover ${item.name}`}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => onDec(item.produto_id)}
                        aria-label={`Diminuir ${item.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span
                        data-testid="pdv-cart-item-qty"
                        className="min-w-6 text-center text-sm font-semibold tabular-nums text-slate-900"
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInc(item.produto_id)}
                        aria-label={`Aumentar ${item.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <strong
                      data-testid="pdv-cart-item-subtotal"
                      className="text-sm font-semibold tabular-nums text-slate-900"
                    >
                      {currencyFormatter.format(subtotal)}
                    </strong>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Rodapé sticky: total ao vivo + PAGAR. */}
      <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500">Total</span>
          <strong
            data-testid="pdv-cart-total"
            className="text-2xl font-semibold tabular-nums text-slate-950"
          >
            {currencyFormatter.format(total)}
          </strong>
        </div>
        <button
          type="button"
          onClick={onPay}
          disabled={payDisabled}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#0891b2_0%,#0f766e_100%)] px-6 py-4 text-base font-semibold text-white shadow-[0_16px_32px_rgba(8,145,178,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
        >
          PAGAR · F2
        </button>
      </div>
    </div>
  );
}
