'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
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
 * Card de produto limpo, minimalista e responsivo.
 * - Imagem quadrada
 * - Nome do produto
 * - Preco (com original riscado se houver desconto)
 * - CTA "Adicionar" sutil
 * - Badge de estoque baixo
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
        'group block overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02] transition hover:border-white/12 hover:bg-white/[0.04]',
        outOfStock && 'opacity-60',
        className
      )}
    >
      {/* Imagem */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <PlaceholderImage name={product.name} />
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1.5">
          {outOfStock && (
            <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 backdrop-blur-sm">
              Esgotado
            </span>
          )}
          {lowStock && !outOfStock && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200 backdrop-blur-sm">
              Ultimas {product.stock}
            </span>
          )}
        </div>

        {/* Floating action button */}
        {!outOfStock && (
          <div className="absolute bottom-2 right-2 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        {product.category && (
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
            {product.category}
          </p>
        )}
        <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-white">
          {product.name}
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-base font-semibold text-white">
            {formatCurrency(product.price)}
          </p>
          {hasDiscount && (
            <p className="text-xs text-slate-500 line-through">
              {formatCurrency(product.original_price!)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Placeholder bonito para produtos sem imagem.
 * Usa gradiente baseado no nome para parecer consistente.
 */
function PlaceholderImage({ name }: { name: string }) {
  // Hash simples baseado no nome
  const hash = name.split('').reduce((a, c) => c.charCodeAt(0) + ((a << 5) - a), 0);
  const gradients = [
    'from-emerald-400/20 to-cyan-300/10',
    'from-amber-300/20 to-orange-300/10',
    'from-violet-400/20 to-fuchsia-300/10',
    'from-rose-300/20 to-pink-300/10',
    'from-sky-300/20 to-blue-300/10',
    'from-lime-300/20 to-emerald-300/10',
  ];
  const gradient = gradients[Math.abs(hash) % gradients.length];

  // Iniciais do produto
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', gradient)}>
      <span className="text-3xl font-semibold tracking-tight text-white/40 sm:text-4xl">
        {initials || '·'}
      </span>
    </div>
  );
}
