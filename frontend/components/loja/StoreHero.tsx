'use client';

import { ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';

interface StoreHeroProps {
  /** Tagline grande sob o titulo. */
  tagline: string;
  /** Disparado quando o usuario clica em "Abrir carrinho". */
  onOpenCart: () => void;
}

/**
 * Hero principal da vitrine: badge "experiencia premium", titulo grande,
 * tagline da loja, 3 micro-cards (checkout/estoque/percepcao) e CTAs
 * "Explorar catalogo" + "Abrir carrinho".
 *
 * Self-contained - so consome 2 props (tagline + onOpenCart).
 */
export function StoreHero({ tagline, onOpenCart }: StoreHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.04] p-7 shadow-[0_35px_120px_-60px_rgba(2,6,23,0.95)] sm:p-9">
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_45%)]" />

      <div className="relative">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
          <Sparkles className="size-3.5" />
          experiencia de compra premium
        </div>

        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Venda com uma vitrine que transmite
          <span className="block text-muted-foreground">
            clareza, desejo e confianca.
          </span>
        </h2>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {tagline}
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              checkout
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Fluxo simples, com entrega, retirada, Pix e dinheiro.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              estoque
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Disponibilidade clara para reduzir atrito e frustracao.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              percepcao
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Design mais nobre, elegante e pronto para impressionar.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="#catalogo"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Explorar catalogo
            <ArrowRight className="size-4" />
          </a>
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
          >
            Abrir carrinho
            <ShoppingBag className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
