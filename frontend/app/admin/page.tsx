'use client';

import Link from 'next/link';
import { ArrowUpRight, BarChart3, Users, Package, Receipt } from 'lucide-react';
import { useAdminData } from '@/components/admin/shell/AdminDataProvider';

/** Página inicial do painel admin. A casca (AdminShell) fornece o layout e a nav. */
export default function AdminPage() {
  // Lê do provider compartilhado — NÃO chama useStock() ou useOrders() aqui.
  const { attentionCount, pedidosCount } = useAdminData();

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Admin</p>
        <h1
          className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          O cockpit do <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>dono</em>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70">
          Visão executiva de vendas, canais, margens e produtos. Decisão com leitura, não com achismo.
        </p>

        {/* Números do provider */}
        {(pedidosCount > 0 || (attentionCount != null && attentionCount > 0)) && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {pedidosCount > 0 && (
              <Link
                href="/admin/pedidos"
                className="inline-flex items-center gap-2 rounded-full border border-[#b8654a]/30 bg-[#b8654a]/8 px-4 py-2 text-[13px] font-medium text-[#b8654a] transition hover:bg-[#b8654a]/15"
              >
                {pedidosCount} {pedidosCount === 1 ? 'pedido novo' : 'pedidos novos'}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {attentionCount != null && attentionCount > 0 && (
              <Link
                href="/admin/estoque"
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] font-medium text-amber-800 transition hover:bg-amber-100"
              >
                {attentionCount}{' '}
                {attentionCount === 1
                  ? 'produto precisa de reposição'
                  : 'produtos precisam de reposição'}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 gap-px bg-[#1a1814]/8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: BarChart3, t: 'Vendas', d: 'Por canal, periodo, SKU' },
            { i: Users, t: 'Clientes', d: 'Historico e segmentos' },
            { i: Package, t: 'Estoque', d: 'Niveis e reposicao' },
            { i: Receipt, t: 'Pedidos', d: 'Status e historico' },
          ].map((m) => (
            <div key={m.t} className="bg-[#f6f3ee] p-6 text-left">
              <m.i className="h-5 w-5 text-[#b8654a]" strokeWidth={1.4} />
              <h3
                className="mt-4 text-[16px] font-normal tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {m.t}
              </h3>
              <p className="mt-1.5 text-[12px] text-[#1a1814]/60">{m.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/admin/pedidos"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
          >
            Gerenciar pedidos
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/admin/estoque"
            className="group inline-flex h-12 items-center gap-2 rounded-full border border-[#1a1814]/20 px-7 text-[14px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5"
          >
            Ver estoque
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
