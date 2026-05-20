'use client';

import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';

interface SalesOverviewPanelProps {
  monthlyRevenue: number;
  operationsInFlight: number;
  activeProductsCount: number;
  dominantChannel: { channel: string; value: number } | null;
  inactiveProductsCount: number;
}

function formatChannel(channel?: string) {
  const labels: Record<string, string> = {
    pdv: 'PDV',
    ecommerce: 'E-commerce',
    whatsapp: 'WhatsApp',
  };
  return channel ? labels[channel] || channel : 'Canal nao informado';
}

export function SalesOverviewPanel({
  monthlyRevenue,
  operationsInFlight,
  activeProductsCount,
  dominantChannel,
  inactiveProductsCount,
}: SalesOverviewPanelProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className={cn(panelClassName, 'relative overflow-hidden p-7 sm:p-9')}>
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_45%)]" />

        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
            <ShieldCheck className="size-3.5" />
            visao executiva da operacao
          </div>

          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Seu negocio merece um dashboard que parece
            <span className="block text-muted-foreground">produto premium, nao painel improvisado.</span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Receita, canais, pedidos e produtos agora aparecem com mais hierarquia visual,
            mais leitura estrategica e mais presenca de marca.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                receita mensal
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {formatCurrency(monthlyRevenue)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                pedidos em curso
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {operationsInFlight}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                produtos ativos
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {activeProductsCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className={cn(panelClassName, 'p-6 sm:p-7')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">leitura rapida</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">O que importa agora</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Um retrato rapido do que esta puxando a operacao para cima e do que merece atencao imediata.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                canal dominante
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {dominantChannel ? formatChannel(dominantChannel.channel) : 'Aguardando volume'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dominantChannel
                  ? `${formatCurrency(dominantChannel.value)} vendidos por este canal.`
                  : 'Assim que os canais venderem, o ranking aparece aqui.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                saude do catalogo
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {inactiveProductsCount === 0
                  ? 'Catalogo totalmente ativo'
                  : `${inactiveProductsCount} produto(s) inativo(s)`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Mantem o foco entre expansao comercial e limpeza operacional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
