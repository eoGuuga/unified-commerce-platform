'use client';

import Link from 'next/link';
import { Store, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Estado vazio para a loja quando não há produtos.
 * Substitui "Carregando loja..." e placeholders feios.
 */
export function EmptyStoreState() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-xl text-center">
        {/* Ícone decorativo */}
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-[0_24px_80px_-32px_rgba(34,211,238,0.4)]">
          <Store className="h-10 w-10 text-accent" strokeWidth={1.5} />
        </div>

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          Vitrine em curadoria
        </div>

        {/* Headline */}
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
          Sua vitrine está sendo preparada
        </h1>

        {/* Subheadline */}
        <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
          Estamos selecionando produtos e organizando a experiência para você.
          Em breve, a vitrine estará aberta com curadoria premium e leitura de estoque em tempo real.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100"
          >
            <Link href="/login">
              Entrar no painel
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 rounded-full border-white/12 bg-white/[0.04] px-6 text-sm font-semibold text-white hover:border-white/20 hover:bg-white/[0.08]"
          >
            <Link href="/">
              Voltar ao início
            </Link>
          </Button>
        </div>

        {/* Sinais de confiança */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Estoque sincronizado
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Checkout seguro
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            Entrega rastreada
          </span>
        </div>
      </div>
    </div>
  );
}
