'use client';

import { useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/format';
import { toast } from 'react-hot-toast';

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    sku?: string;
    image?: string;
    stock: number;
  };
  className?: string;
  onAdded?: () => void;
}

export function AddToCartButton({ product, className, onAdded }: AddToCartButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem(product, quantity);
    toast.success(`${quantity}x ${product.name} adicionado(s) ao carrinho`);
    setIsOpen(false);
    setQuantity(1);
    onAdded?.();
  };

  const maxQuantity = Math.min(product.stock, 99);
  const canAdd = quantity > 0 && quantity <= product.stock;

  return (
    <div className={className}>
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="w-full"
        disabled={product.stock === 0}
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        {product.stock === 0 ? 'Indisponivel' : 'Adicionar ao Carrinho'}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 text-left shadow-xl transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Adicionar ao Carrinho</h3>
                  <p className="text-sm text-gray-600 mt-1">{product.name}</p>

                  {product.sku && (
                    <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
                  )}

                  <p className="text-lg font-semibold mt-2 text-primary">
                    {formatCurrency(product.price)}
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    Estoque: {product.stock} unidade{product.stock !== 1 ? 's' : ''}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Quantidade:</span>
                  <QuantitySelector
                    value={quantity}
                    onValueChange={setQuantity}
                    min={1}
                    max={maxQuantity}
                  />
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Total: {formatCurrency(product.price * quantity)}
                  </span>

                  <Button onClick={handleAddToCart} disabled={!canAdd} className="px-6">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <p className="text-xs text-gray-500">
                  {maxQuantity < 99 && `Maximo de ${maxQuantity} unidades`}
                  {maxQuantity >= 99 && 'Quantidade maxima: 99'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}