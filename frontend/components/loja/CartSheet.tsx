'use client';

import { ShoppingCart, Minus, Plus, Trash2, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCart, CartItem } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import Link from 'next/link';

/**
 * CartSheet compativel com o page.tsx atual.
 * Aceita props externas (modo legado) OU usa useCart() interno.
 *
 * - Modo legado: page.tsx passa cart/cartCount/onUpdateQuantity etc.
 * - Modo novo: nao passa nada, usa useCart() diretamente.
 */
interface LegacyCartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryType: 'delivery' | 'pickup';
  onUpdateQuantity: (id: string, qty: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

interface NewCartSheetProps {
  trigger?: React.ReactNode;
  className?: string;
}

type CartSheetProps = LegacyCartSheetProps | NewCartSheetProps;

export function CartSheet(props: CartSheetProps) {
  // Detectar se estamos no modo legado (tem prop `cart`)
  const isLegacy = 'cart' in props && Array.isArray((props as LegacyCartSheetProps).cart);

  // Hook novo (sempre chamamos - regras dos hooks)
  const cartHook = useCart();

  // Dados efetivos (legado ou hook)
  const items = isLegacy ? (props as LegacyCartSheetProps).cart : cartHook.items;
  const totalItems = isLegacy ? (props as LegacyCartSheetProps).cartCount : cartHook.totalItems;
  const subtotal = isLegacy ? (props as LegacyCartSheetProps).subtotal : cartHook.subtotal;
  const deliveryFee = isLegacy ? (props as LegacyCartSheetProps).deliveryFee : cartHook.deliveryFee;
  const total = isLegacy ? (props as LegacyCartSheetProps).total : cartHook.total;
  const deliveryType = isLegacy ? (props as LegacyCartSheetProps).deliveryType : cartHook.deliveryType;

  const handleUpdateQuantity = (id: string, qty: number) => {
    if (isLegacy) {
      (props as LegacyCartSheetProps).onUpdateQuantity(id, qty);
    } else {
      cartHook.updateQuantity(id, qty);
    }
  };

  const handleRemoveItem = (id: string) => {
    if (isLegacy) {
      (props as LegacyCartSheetProps).onUpdateQuantity(id, 0);
    } else {
      cartHook.removeItem(id);
    }
  };

  const handleClearCart = () => {
    if (isLegacy) {
      (props as LegacyCartSheetProps).onClearCart();
    } else {
      cartHook.clearCart();
    }
  };

  const handleCheckout = () => {
    if (isLegacy) {
      (props as LegacyCartSheetProps).onCheckout();
    } else {
      // No-op - botao usa Link para /loja/checkout
    }
  };

  const handleContinueShopping = () => {
    if (isLegacy) {
      (props as LegacyCartSheetProps).onContinueShopping();
    } else {
      // No-op no modo novo
    }
  };

  // Controle de abertura (so faz sentido no modo legado)
  const isOpen = isLegacy ? (props as LegacyCartSheetProps).open : false;
  const onOpenChange = isLegacy
    ? (props as LegacyCartSheetProps).onOpenChange
    : (_open: boolean) => { /* no-op */ };

  const hasItems = items.length > 0;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden bg-background">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Seu carrinho
          </SheetTitle>
          <SheetDescription>
            {hasItems
              ? `${totalItems} item${totalItems === 1 ? '' : 's'} no carrinho`
              : 'Seu carrinho está vazio'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {hasItems ? (
            <>
              {/* Tipo de entrega */}
              <div className="mb-6 p-4 border rounded-lg">
                <h4 className="text-sm font-medium mb-3">Tipo de entrega</h4>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>Atual: {deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                </div>
                {deliveryType === 'delivery' && subtotal > 0 && subtotal < 30 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-xs text-yellow-800">
                        <p className="font-medium">Frete aplicado</p>
                        <p>Adicione mais R$ {(30 - subtotal).toFixed(2)} para frete grátis</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Itens do carrinho */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <h5 className="font-medium text-sm">{item.name}</h5>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} unidade
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="h-8 w-8"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium min-w-[2rem] text-center">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium min-w-[3rem] text-right">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumo */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                {deliveryType === 'delivery' && subtotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Frete</span>
                    <span className={subtotal >= 30 ? 'text-green-600' : ''}>
                      {subtotal >= 30 ? 'Grátis' : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                {/* Botao de checkout */}
                {isLegacy ? (
                  <Button
                    className="w-full mt-4"
                    onClick={handleCheckout}
                    disabled={total <= 0 || (deliveryType === 'delivery' && subtotal < 30)}
                  >
                    Finalizar compra
                  </Button>
                ) : (
                  <Link href="/loja/checkout">
                    <Button className="w-full mt-4" disabled={!cartHook.canCheckout}>
                      Finalizar compra
                    </Button>
                  </Link>
                )}

                <Button
                  onClick={handleClearCart}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  Limpar carrinho
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Carrinho vazio</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Adicione produtos para começar a comprar
                </p>
                <Button onClick={handleContinueShopping}>Ver produtos</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
