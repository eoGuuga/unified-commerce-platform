'use client';

import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { Product } from '@/lib/types/product';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { Star, Package, Truck, CheckCircle } from 'lucide-react';

interface ProductDetailProps {
  product: Product;
  onAddToCart?: (product: Product, quantity: number) => void;
}

export function ProductDetail({ product, onAddToCart }: ProductDetailProps) {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  const stock = product.stock ?? 0;

  const stockStatus = stock === 0 ? 'indisponivel' :
                     stock < 10 ? 'baixo' : 'disponivel';

  const stockBadgeVariant = stockStatus === 'indisponivel' ? 'destructive' :
                           stockStatus === 'baixo' ? 'secondary' : 'default';

  const maxQuantity = Math.min(stock, 99);

  const handleAddToCart = () => {
    // Converter Decimal para number se necessário
    const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
    addItem({ ...product, price }, quantity);
    onAddToCart?.(product, quantity);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Product Images */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Package className="h-16 w-16 text-gray-400" />
              </div>
            )}
          </div>

          {/* Additional Images */}
          {product.additional_images && product.additional_images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.additional_images.map((image, index) => (
                <button
                  key={index}
                  className="relative w-20 h-20 rounded border-2 overflow-hidden flex-shrink-0"
                >
                  <img
                    src={image}
                    alt={`${product.name} - ${index + 1}`}
                    className="w-full h-full object-cover"
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

          {/* Name and Rating */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">{product.name}</h1>

            {product.rating && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(product.rating!)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
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
          </div>

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
              size="lg"
              className="w-full"
            >
              <Package className="mr-2 h-5 w-5" />
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

          {/* Additional Info */}
          <div className="border-t pt-6">
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
        </div>
      </div>
    </div>
  );
}