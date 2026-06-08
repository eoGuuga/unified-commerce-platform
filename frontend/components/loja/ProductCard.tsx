'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, ShoppingCart, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddToCartButton } from './AddToCartButton';
import { Product } from '@/lib/types/product';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  className?: string;
  onClick?: () => void;
}

export function ProductCard({ product, className, onClick }: ProductCardProps) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const stockStatus = product.stock === 0 ? 'indisponivel' :
                     product.stock < 10 ? 'baixo' : 'disponivel';

  const stockBadgeVariant = stockStatus === 'indisponivel' ? 'destructive' :
                           stockStatus === 'baixo' ? 'secondary' : 'default';

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200 hover:shadow-lg',
        stockStatus === 'indisponivel' && 'opacity-60',
        className
      )}
      onClick={onClick && product.stock > 0 ? onClick : undefined}
    >
      <CardContent className="p-0">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-t-lg">
          {product.image_url ? (
            <>
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className={cn(
                  'object-cover transition-transform duration-300 group-hover:scale-105',
                  isImageLoaded ? 'opacity-100' : 'opacity-0'
                )}
                onLoad={() => setIsImageLoaded(true)}
                onError={() => setHasError(true)}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              {!isImageLoaded && !hasError && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse" />
              )}
              {hasError && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <div className="text-gray-400 text-sm">Sem imagem</div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              <div className="text-gray-400 text-sm">Sem imagem</div>
            </div>
          )}

          {/* Stock Badge */}
          <div className="absolute top-2 left-2">
            <Badge variant={stockBadgeVariant} className="text-xs">
              {product.stock === 0 ? 'Indisponível' :
               product.stock < 10 ? `Apenas ${product.stock} unid` :
               'Em estoque'}
            </Badge>
          </div>

          {/* Quick View Button */}
          {onClick && product.stock > 0 && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4 space-y-3">
          {/* Category */}
          {product.category && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {product.category}
            </p>
          )}

          {/* Name */}
          <h3 className="font-semibold text-sm line-clamp-2 leading-tight">
            {product.name}
          </h3>

          {/* SKU */}
          {product.sku && (
            <p className="text-xs text-muted-foreground font-mono">
              SKU: {product.sku}
            </p>
          )}

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-1">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < Math.floor(product.rating!)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {product.rating.toFixed(1)}
              </span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(product.price)}
              </p>
              {product.original_price && product.original_price > product.price && (
                <p className="text-xs text-muted-foreground line-through">
                  {formatCurrency(product.original_price)}
                </p>
              )}
            </div>

            {/* Add to Cart Button */}
            <div className="flex-shrink-0 ml-2">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  sku: product.sku,
                  image: product.image_url,
                  stock: product.stock,
                }}
                className="h-9 px-3"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ProductGridProps {
  products: Product[];
  className?: string;
  onProductClick?: (product: Product) => void;
}

export function ProductGrid({ products, className, onProductClick }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
      className
    )}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => onProductClick?.(product)}
        />
      ))}
    </div>
  );
}