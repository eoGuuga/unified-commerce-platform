'use client';

/**
 * PdvCartExpanded — overlay "carrinho completo" do PDV (Parte 2 da tela de caixa).
 *
 * Mesma tela, sem rota nova: um painel ampliado que mostra TODOS os itens com folga
 * (nome, preco unit, stepper −/+, subtotal por item, remover) e mantem o TOTAL e o
 * PAGAR sempre visiveis. Usa EXATAMENTE os mesmos callbacks do `usePdvSale` que o
 * PdvCart compacto — sem nova logica de carrinho/pedido.
 *
 * Fechar a expansao volta ao modo compacto (`onClose`). "PAGAR" no expandido aciona
 * `onPay` (a pagina fecha o overlay e abre o modal de pagamento).
 */

import { Minus, Plus, Trash2, ShoppingCart, X } from 'lucide-react';
import type { PdvCartItem } from '@/lib/pdv/cart';

export interface PdvCartExpandedProps {
  items: PdvCartItem[];
  total: number;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onPay: () => void;
  /** A página passa `items.length === 0`. */
  payDisabled: boolean;
  /** Volta ao modo compacto. */
  onClose: () => void;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function PdvCartExpanded({
  items,
  total,
  onInc,
  onDec,
  onRemove,
  onPay,
  payDisabled,
  onClose,
}: PdvCartExpandedProps) {
  const isEmpty = items.length === 0;
  const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho completo"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.4)]">
        {/* Cabecalho: titulo + contagem + fechar. */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShoppingCart className="size-4" />
            </span>
            <div className="leading-tight">
              <h2 className="text-base font-semibold text-slate-950">Carrinho completo</h2>
              <p className="text-[11px] text-slate-500">
                {isEmpty
                  ? 'Carrinho vazio'
                  : `${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar carrinho completo"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <X className="size-3.5" />
            Fechar
          </button>
        </div>

        {/* Lista ampla — itens com folga; so esta area rola. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isEmpty ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-center">
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
                    data-testid="pdv-cart-expanded-item"
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3.5"
                  >
                    {/* Nome + preco unitario. */}
                    <div className="min-w-0 flex-1">
                      <p
                        data-testid="pdv-cart-expanded-item-name"
                        className="truncate text-base font-semibold leading-tight text-slate-900"
                      >
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {currencyFormatter.format(item.unit_price)} / un
                      </p>
                    </div>

                    {/* Stepper −/+ (folgado). */}
                    <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => onDec(item.produto_id)}
                        aria-label={`Diminuir ${item.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span
                        data-testid="pdv-cart-expanded-item-qty"
                        className="min-w-7 text-center text-base font-semibold tabular-nums text-slate-900"
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInc(item.produto_id)}
                        aria-label={`Aumentar ${item.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>

                    {/* Subtotal por item. */}
                    <strong
                      data-testid="pdv-cart-expanded-item-subtotal"
                      className="w-24 shrink-0 text-right text-base font-semibold tabular-nums text-slate-900"
                    >
                      {currencyFormatter.format(subtotal)}
                    </strong>

                    {/* Remover. */}
                    <button
                      type="button"
                      onClick={() => onRemove(item.produto_id)}
                      aria-label={`Remover ${item.name}`}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Rodapé fixo — TOTAL + PAGAR sempre a vista (mesma assinatura do compacto). */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Total
            </span>
            <strong
              data-testid="pdv-cart-expanded-total"
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
    </div>
  );
}
