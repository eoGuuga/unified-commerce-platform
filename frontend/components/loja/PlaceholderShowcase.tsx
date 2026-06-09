'use client';

import Link from 'next/link';
import { ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';

/**
 * Cards de produtos placeholder bonitos para quando a loja nao tem produtos.
 * Usa gradientes SVG inline (sem dependencia de imagens externas).
 */
const placeholderProducts = [
  {
    title: 'Colecao Essenciais',
    description: 'Curadoria premium com pecas selecionadas para o dia a dia',
    gradient: 'from-emerald-400/20 via-cyan-300/15 to-transparent',
    accent: 'bg-emerald-400',
    icon: 'leaf',
  },
  {
    title: 'Atendimento Humano',
    description: 'Equipe treinada para uma experiencia de compra memoravel',
    gradient: 'from-amber-300/20 via-orange-300/15 to-transparent',
    accent: 'bg-amber-300',
    icon: 'people',
  },
  {
    title: 'Entrega Rastreada',
    description: 'Logistica cuidada para receber sua compra com seguranca',
    gradient: 'from-violet-400/20 via-fuchsia-300/15 to-transparent',
    accent: 'bg-violet-400',
    icon: 'truck',
  },
];

const ProductIcon = ({ icon }: { icon: string }) => {
  const className = 'h-6 w-6 text-white';
  if (icon === 'leaf') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21c3-3 6-3 9 0M12 18V8c0-2 1-4 3-5 0 4-2 7-6 7m-3 4c-1 0-2 0-3-1 0-3 2-5 5-5" />
      </svg>
    );
  }
  if (icon === 'people') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a3 3 0 015.36-1.87M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM6 10a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  );
};

export function PlaceholderShowcase() {
  return (
    <div className="space-y-6">
      {/* Header da secao */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Em breve
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Estamos preparando a vitrine para voce
          </h2>
          <p className="mt-3 max-w-xl text-base text-slate-300">
            Curadoria premium chegando em breve. Enquanto isso, conheca o que faz da nossa operacao um ecossistema unico.
          </p>
        </div>
      </div>

      {/* Cards placeholder */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderProducts.map((product) => (
          <div
            key={product.title}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 transition hover:-translate-y-1 hover:border-white/20"
          >
            {/* Gradiente decorativo no topo */}
            <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${product.gradient} blur-2xl`} />

            {/* Icone decorativo */}
            <div className="relative mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40">
              <ProductIcon icon={product.icon} />
              <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${product.accent} ring-2 ring-slate-950`} />
            </div>

            <h3 className="relative text-lg font-semibold tracking-[-0.02em] text-white">
              {product.title}
            </h3>
            <p className="relative mt-2 text-sm leading-6 text-slate-300">
              {product.description}
            </p>

            <div className="relative mt-6 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">Em breve</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition group-hover:border-accent/40 group-hover:bg-accent/10">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA inferior */}
      <div className="mt-2 flex flex-col items-center gap-3 rounded-3xl border border-white/8 bg-white/[0.02] p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-base font-semibold text-white">Voce e lojista?</p>
          <p className="mt-1 text-sm text-slate-300">
            Cadastre seus produtos e abra sua vitrine premium em minutos.
          </p>
        </div>
        <Link
          href="/login"
          className="group inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          Entrar no painel
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
