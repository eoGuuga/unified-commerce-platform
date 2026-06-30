'use client';

import { Minus, Plus, Trash2, ShoppingCart, Maximize2 } from 'lucide-react';
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
  /**
   * Abre o overlay "carrinho completo" (modo expandido). Opcional: quando ausente,
   * o botao "Expandir" nao e renderizado (compatibilidade com usos sem expansao).
   */
  onExpand?: () => void;
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
  onExpand,
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-4 text-slate-500" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
            Carrinho
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <Maximize2 className="size-3.5" />
              Expandir
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            Limpar
          </button>
        </div>
      </div>

      {/* So a lista rola; o rodapé (TOTAL + PAGAR) fica sempre visivel. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {isEmpty ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
            <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
              <ShoppingCart className="size-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">
              Carrinho vazio — busque um produto
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const subtotal = item.unit_price * item.quantity;
              return (
                <li
                  key={item.produto_id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-2"
                >
                  {/* Nome + preco unitario (linha enxuta). */}
                  <div className="min-w-0 flex-1">
                    <p
                      data-testid="pdv-cart-item-name"
                      className="truncate text-sm font-semibold leading-tight text-slate-900"
                    >
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {currencyFormatter.format(item.unit_price)} / un
                    </p>
                  </div>

                  {/* Stepper compacto −/+ */}
                  <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => onDec(item.produto_id)}
                      aria-label={`Diminuir ${item.name}`}
                      className="inline-flex size-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span
                      data-testid="pdv-cart-item-qty"
                      className="min-w-5 text-center text-sm font-semibold tabular-nums text-slate-900"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInc(item.produto_id)}
                      aria-label={`Aumentar ${item.name}`}
                      className="inline-flex size-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {/* Subtotal + remover */}
                  <strong
                    data-testid="pdv-cart-item-subtotal"
                    className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900"
                  >
                    {currencyFormatter.format(subtotal)}
                  </strong>
                  <button
                    type="button"
                    onClick={() => onRemove(item.produto_id)}
                    aria-label={`Remover ${item.name}`}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Rodapé fixo — a ASSINATURA: TOTAL grande + PAGAR proeminente, sempre a vista. */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total
          </span>
          <strong
            data-testid="pdv-cart-total"
            className="text-3xl font-bold tabular-nums text-slate-950"
          >
            {currencyFormatter.format(total)}
          </strong>
        </div>
        <button
          type="button"
          onClick={onPay}
          disabled={payDisabled}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0891b2_0%,#0f766e_100%)] px-6 py-3.5 text-base font-bold tracking-wide text-white shadow-[0_12px_28px_rgba(8,145,178,0.24)] transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
        >
          PAGAR · F2
        </button>
      </div>
    </div>
  );
}
