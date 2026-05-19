'use client';

import { ArrowRight, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatCurrency } from '@/lib/format';
import { SummaryRow } from './SummaryRow';

export interface CartSheetItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartSheetItem[];
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryType: 'delivery' | 'pickup';
  onUpdateQuantity: (id: string, quantity: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

/**
 * Side sheet do carrinho da loja online. Apresenta itens, controla
 * quantidade e expoe os botoes "Finalizar compra" + "Limpar carrinho".
 */
export function CartSheet({
  open,
  onOpenChange,
  cart,
  cartCount,
  subtotal,
  deliveryFee,
  total,
  deliveryType,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
  onContinueShopping,
}: CartSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-hidden border-white/10 bg-[rgba(5,8,22,0.97)] p-0 text-foreground sm:max-w-xl">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-white/10 px-6 py-6">
            <div className="flex items-start justify-between gap-4 pr-10">
              <div>
                <SheetTitle className="text-2xl tracking-tight text-foreground">
                  Seu carrinho
                </SheetTitle>
                <SheetDescription className="mt-2">
                  Revise os itens e siga para um checkout mais claro e confiavel.
                </SheetDescription>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {cartCount} item{cartCount === 1 ? '' : 's'}
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {cart.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.08)_0%,rgba(56,189,248,0.06)_38%,rgba(255,255,255,0.03)_100%)] p-6">
                <div className="text-center">
                  <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                    Carrinho vazio
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Adicione o primeiro produto e veja como o checkout assume o resto com mais elegancia.
                  </p>
                </div>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      entrega ou retirada
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      O cliente entende o caminho do pedido sem friccao.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      pagamento claro
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Pix e dinheiro aparecem com resumo, valor e confirmacao mais limpos.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      estoque confiavel
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      A disponibilidade visivel evita surpresa e protege a percepcao da marca.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onContinueShopping}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                >
                  Explorar catalogo
                  <ArrowRight className="size-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold tracking-tight text-foreground">
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatCurrency(item.price)} por unidade
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, 0)}
                        className="rounded-full border border-white/10 p-2 text-muted-foreground transition hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-100"
                        aria-label={`Remover ${item.name} do carrinho`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className="rounded-xl p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                          aria-label={`Diminuir quantidade de ${item.name}`}
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="min-w-10 px-2 text-center text-sm font-semibold text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className="rounded-xl p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                          aria-label={`Aumentar quantidade de ${item.name}`}
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>

                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-6 py-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 space-y-3">
                <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                <SummaryRow
                  label={deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
                  value={
                    deliveryType === 'delivery'
                      ? formatCurrency(deliveryFee)
                      : 'Sem taxa'
                  }
                />
                <SummaryRow label="Total" value={formatCurrency(total)} strong />
              </div>

              <button
                type="button"
                onClick={onCheckout}
                disabled={cart.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Finalizar compra
                <ArrowRight className="size-4" />
              </button>

              <button
                type="button"
                onClick={onClearCart}
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
              >
                Limpar carrinho
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
