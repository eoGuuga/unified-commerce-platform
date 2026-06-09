'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image?: string;
    image_url?: string;
    category?: string;
    stock?: number;
    original_price?: number;
  };
  className?: string;
}

/**
 * Card de produto editorial - limpo e minimalista.
 * Tema off-white, sem bordas pesadas.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const imageUrl = product.image_url || product.image;
  const hasDiscount = product.original_price && product.original_price > product.price;
  const lowStock = product.stock !== undefined && product.stock > 0 && product.stock < 5;
  const outOfStock = product.stock === 0;

  return (
    <Link
      href={`/loja/produto/${product.id}`}
      className={cn(
        'group block transition',
        outOfStock && 'opacity-50',
        className
      )}
    >
      {/* Imagem com aspect ratio 4:5 (editorial) */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] bg-[#1a1814]/5">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <PlaceholderImage name={product.name} />
        )}

        {/* Badges no topo esquerdo */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {outOfStock && (
            <span className="rounded-[2px] bg-[#1a1814] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#f6f3ee]">
              Esgotado
            </span>
          )}
          {lowStock && !outOfStock && (
            <span className="rounded-[2px] bg-[#b8654a] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#f6f3ee]">
              Últimas {product.stock}
            </span>
          )}
        </div>

        {/* CTA flutuante no hover */}
        {!outOfStock && (
          <div className="absolute bottom-3 right-3 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1814] text-[#f6f3ee] shadow-lg transition group-hover:scale-105">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-5 space-y-1.5">
        {product.category && (
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/45">
            {product.category}
          </p>
        )}
        <h3
          className="text-[16px] font-normal leading-[1.3] tracking-[-0.01em] text-[#1a1814] line-clamp-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2 pt-1">
          <p className="text-[15px] font-medium text-[#1a1814]">
            {formatCurrency(product.price)}
          </p>
          {hasDiscount && (
            <p className="text-[13px] text-[#1a1814]/40 line-through">
              {formatCurrency(product.original_price!)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function PlaceholderImage({ name }: { name: string }) {
  const hash = name.split('').reduce((a, c) => c.charCodeAt(0) + ((a << 5) - a), 0);
  const gradients = [
    'from-[#e8d5c4] to-[#d4b896]',
    'from-[#c7d3c0] to-[#8b9d7e]',
    'from-[#d6c9c0] to-[#a08b7a]',
    'from-[#b8a89c] to-[#7a6655]',
    'from-[#cdb89c] to-[#8a6f4a]',
    'from-[#a8b5b0] to-[#5d6e69]',
  ];
  const gradient = gradients[Math.abs(hash) % gradients.length];

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
      <span
        className="text-[48px] font-normal text-[#1a1814]/35"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {initials || '·'}
      </span>
    </div>
  );
}
