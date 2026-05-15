interface ProductGridSkeletonProps {
  /** Numero de cards-skeleton a renderizar. Default 6. */
  count?: number;
}

/**
 * Skeletons animados pra grid de produtos durante o load do catalogo.
 * Cada placeholder mimica o layout dos cards reais (imagem + titulo +
 * descricao + botao).
 */
export function ProductGridSkeleton({ count = 6 }: ProductGridSkeletonProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6"
        >
          <div className="h-32 animate-pulse rounded-[24px] bg-white/[0.06]" />
          <div className="mt-6 h-6 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/[0.05]" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-white/[0.05]" />
          <div className="mt-6 h-12 animate-pulse rounded-2xl bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}
