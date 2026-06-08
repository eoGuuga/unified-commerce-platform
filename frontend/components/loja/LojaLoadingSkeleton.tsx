'use client';

import { cn } from '@/lib/utils';

/**
 * Skeleton de carregamento para a página da loja.
 * Substitui o "Carregando loja..." feio.
 */
export function LojaLoadingSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Header skeleton */}
      <div className="border-b border-white/6 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/8" />
            <div>
              <div className="h-4 w-32 animate-pulse rounded bg-white/8" />
              <div className="mt-1.5 h-2.5 w-20 animate-pulse rounded bg-white/5" />
            </div>
          </div>
          <div className="hidden gap-3 md:flex">
            <div className="h-10 w-24 animate-pulse rounded-full bg-white/6" />
            <div className="h-10 w-32 animate-pulse rounded-full bg-white/8" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {/* Hero skeleton */}
        <div className="mb-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="h-5 w-40 animate-pulse rounded-full bg-accent/15" />
            <div className="mt-6 h-12 w-3/4 animate-pulse rounded bg-white/8" />
            <div className="mt-3 h-12 w-2/3 animate-pulse rounded bg-white/8" />
            <div className="mt-6 space-y-2">
              <div className="h-3.5 w-full animate-pulse rounded bg-white/5" />
              <div className="h-3.5 w-5/6 animate-pulse rounded bg-white/5" />
            </div>
            <div className="mt-8 flex gap-3">
              <div className="h-12 w-40 animate-pulse rounded-full bg-white/10" />
              <div className="h-12 w-36 animate-pulse rounded-full bg-white/5" />
            </div>
          </div>
          <div className="h-72 animate-pulse rounded-[2rem] border border-white/8 bg-white/[0.03] lg:h-96" />
        </div>

        {/* Métricas skeleton */}
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-24 animate-pulse rounded-2xl border border-white/6 bg-white/[0.02]'
              )}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        {/* Grid de produtos skeleton */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02]"
              style={{ animationDelay: `${(i % 4) * 0.1}s` }}
            >
              <div className="aspect-square animate-pulse bg-white/[0.04]" />
              <div className="space-y-2 p-4">
                <div className="h-3 w-1/3 animate-pulse rounded bg-white/6" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/8" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-white/8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
