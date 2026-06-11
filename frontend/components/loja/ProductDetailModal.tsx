'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, ShoppingCart, Package, Truck, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Product } from '@/lib/types/product';
import { formatCurrency } from '@/lib/format';
import { AddToCartButton } from './AddToCartButton';
import { cn } from '@/lib/utils';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart?: (product: Product, quantity: number) => void;
}

export function ProductDetailModal({
  product,
  isOpen,
  onOpenChange,
  onAddToCart,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!product) return null;

  const stock = product.stock ?? 0;

  const stockStatus = stock === 0 ? 'indisponivel' :
                     stock < 10 ? 'baixo' : 'disponivel';

  const stockBadgeVariant = stockStatus === 'indisponivel' ? 'destructive' :
                           stockStatus === 'baixo' ? 'secondary' : 'default';

  const handleAddToCart = () => {
    onAddToCart?.(product, quantity);
    onOpenChange(false);
  };

  const maxQuantity = Math.min(stock, 99);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square overflow-hidden rounded-lg">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <Package className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </div>

            {/* Image Thumbnails */}
            {product.additional_images && product.additional_images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.additional_images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative w-20 h-20 rounded border-2 flex-shrink-0 overflow-hidden ${
                      selectedImageIndex === index ? 'border-primary' : 'border-gray-200'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} - ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category and SKU */}
            <div className="space-y-2">
              {product.category && (
                <Badge variant="secondary">{product.category}</Badge>
              )}
              {product.sku && (
                <p className="text-sm text-muted-foreground font-mono">
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Rating */}
            {product.rating && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < Math.floor(product.rating!)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">
                  {product.rating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({product.review_count || 0} avaliações)
                </span>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">
                  {formatCurrency(typeof product.price === 'string' ? parseFloat(product.price) : product.price)}
                </span>
                {product.original_price && (typeof product.original_price === 'number' ? product.original_price : parseFloat(product.original_price as string)) > (typeof product.price === 'number' ? product.price : parseFloat(product.price as string)) && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatCurrency(typeof product.original_price === 'string' ? parseFloat(product.original_price) : product.original_price)}
                  </span>
                )}
                {product.discount && (
                  <Badge variant="destructive">
                    -{product.discount}%
                  </Badge>
                )}
              </div>
            </div>

            {/* Stock Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="font-medium">Estoque:</span>
                <Badge variant={stockBadgeVariant}>
                  {stock === 0 ? 'Indisponível' :
                   stock < 10 ? `Apenas ${stock} unidade${stock > 1 ? 's' : ''}` :
                   `${stock} unidades disponíveis`}
                </Badge>
              </div>

              {stock > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  <span>Entrega estimada: 2-3 dias úteis</span>
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Quantidade:</span>
                <QuantitySelector
                  value={quantity}
                  onValueChange={setQuantity}
                  min={1}
                  max={maxQuantity}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                {maxQuantity < 99 && `Máximo de ${maxQuantity} unidades disponíveis`}
                {maxQuantity >= 99 && 'Quantidade máxima: 99 unidades'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="w-full"
                size="lg"
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {product.stock === 0 ? 'Indisponível' : 'Adicionar ao Carrinho'}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                disabled={product.stock === 0}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Comprar agora
              </Button>
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Características:</h4>
                <ul className="space-y-1">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        <div className="border-t pt-6 mt-6">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>Garantia: 12 meses</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>Frete grátis acima de R$ 30</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span>Troca fácil em 7 dias</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}