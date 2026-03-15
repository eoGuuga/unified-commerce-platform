'use client';

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Layers3,
  Minus,
  PackageCheck,
  PackageSearch,
  PackageX,
  PencilLine,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { getDevCredentials, hasDevCredentials } from '@/lib/config';

interface StockProduct {
  id: string;
  name: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  min_stock: number;
  status: 'ok' | 'low' | 'out';
}

interface StockSummary {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  products: StockProduct[];
}

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';
const controlClassName =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/10';

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className={cn(panelClassName, 'p-5')}>
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function getStatusMeta(status: StockProduct['status']) {
  switch (status) {
    case 'ok':
      return {
        label: 'Estoque saudavel',
        pill: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
        card: 'from-emerald-400/12 via-cyan-400/8 to-transparent',
      };
    case 'low':
      return {
        label: 'Reposicao recomendada',
        pill: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
        card: 'from-amber-300/12 via-orange-400/8 to-transparent',
      };
    case 'out':
      return {
        label: 'Ruptura de estoque',
        pill: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
        card: 'from-rose-400/12 via-red-400/8 to-transparent',
      };
  }
}

export default function EstoquePage() {
  const router = useRouter();
  const { tenantId, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'low' | 'out'>('all');
  const [adjustingProduct, setAdjustingProduct] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<
    Record<string, { quantity: string; reason: string }>
  >({});
  const [minStockEdits, setMinStockEdits] = useState<Record<string, string>>({});

  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const autoLogin = async () => {
      if (typeof window === 'undefined' || authLoading) return;

      if (!isAuthenticated || !tenantId) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const allowAutoLogin = process.env.NEXT_PUBLIC_ALLOW_AUTO_LOGIN === 'true';

        if (isDevelopment && allowAutoLogin && hasDevCredentials()) {
          try {
            const devCreds = getDevCredentials();
            await login(devCreds.email, devCreds.password, devCreds.tenantId);
          } catch (error) {
            console.error('[DEV] Erro no login automatico:', error);
            toast.error('Erro ao fazer login automatico. Verifique as credenciais.');
          }
        } else {
          toast.error('Autenticacao necessaria. Redirecionando para login...');
          router.push('/login');
        }
      }
    };

    void autoLogin();
  }, [authLoading, isAuthenticated, tenantId, login, router]);

  const { data: stockSummary, error, isLoading, mutate } = useSWR<StockSummary>(
    tenantId ? `stock-summary:${tenantId}` : null,
    () => api.getStockSummary(tenantId!),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      onError: (requestError: any) => {
        console.error('Erro ao carregar estoque:', requestError);
        if (!requestError.message?.includes('401')) {
          toast.error('Erro ao carregar estoque. Verifique o console.');
        }
      },
    },
  );

  useEffect(() => {
    if (!error) return;
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('401')) {
      toast.error(message || 'Erro ao carregar estoque.');
    }
  }, [error]);

  const products = useMemo(() => stockSummary?.products || [], [stockSummary?.products]);

  const filteredProducts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(query);
      const matchesFilter = filterStatus === 'all' || product.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [deferredSearchQuery, filterStatus, products]);

  const stats = useMemo(() => {
    const availableUnits = products.reduce((total, product) => total + product.available_stock, 0);
    const reservedUnits = products.reduce((total, product) => total + product.reserved_stock, 0);
    const currentUnits = products.reduce((total, product) => total + product.current_stock, 0);
    const healthyProducts = Math.max(
      0,
      (stockSummary?.total_products || 0) -
        (stockSummary?.low_stock_count || 0) -
        (stockSummary?.out_of_stock_count || 0),
    );

    return {
      availableUnits,
      reservedUnits,
      currentUnits,
      healthyProducts,
    };
  }, [products, stockSummary?.low_stock_count, stockSummary?.out_of_stock_count, stockSummary?.total_products]);

  const handleAdjustStock = async (productId: string, quantity: number, reason?: string) => {
    if (!tenantId) {
      toast.error('Tenant ID nao disponivel.');
      return;
    }

    try {
      await api.adjustStock(productId, quantity, tenantId, reason);
      toast.success('Estoque ajustado com sucesso.');
      setAdjustingProduct(null);
      setAdjustments((previous) => {
        const next = { ...previous };
        delete next[productId];
        return next;
      });
      await mutate();
    } catch (requestError: any) {
      toast.error(requestError.message || 'Erro ao ajustar estoque');
    }
  };

  const handleQuickAdjust = async (productId: string, delta: number) => {
    if (!tenantId) {
      toast.error('Tenant ID nao disponivel.');
      return;
    }

    try {
      await api.adjustStock(
        productId,
        delta,
        tenantId,
        `Ajuste rapido: ${delta > 0 ? '+' : ''}${delta}`,
      );
      toast.success('Estoque ajustado.');
      await mutate();
    } catch (requestError: any) {
      toast.error(requestError.message || 'Erro ao ajustar estoque');
    }
  };

  const handleSetMinStock = async (productId: string, value: number) => {
    if (!tenantId) {
      toast.error('Tenant ID nao disponivel.');
      return;
    }

    if (value < 0 || Number.isNaN(value)) {
      toast.error('Estoque minimo invalido.');
      return;
    }

    try {
      await api.setMinStock(productId, value, tenantId);
      toast.success('Estoque minimo atualizado.');
      setMinStockEdits((previous) => {
        const next = { ...previous };
        delete next[productId];
        return next;
      });
      await mutate();
    } catch (requestError: any) {
      toast.error(requestError.message || 'Erro ao atualizar estoque minimo');
    }
  };

  const handleRefresh = async () => {
    await mutate();
    toast.success('Estoque atualizado.');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />
        <div className="pointer-events-none fixed inset-0 -z-10 mesh-gradient opacity-60" />
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-4 size-14 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
            <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
              carregando operacao de estoque
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(10, 14, 24, 0.96)',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.15)',
          },
        }}
      />

      <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-gradient opacity-60" />
      <div className="pointer-events-none fixed inset-0 -z-10 dot-pattern opacity-[0.08]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.13),transparent_60%)]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
              aria-label="Voltar para dashboard"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-35px_rgba(16,185,129,0.9)]">
              <Warehouse className="size-5 text-accent" />
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
                operacao de estoque
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Gestao de Estoque
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
            >
              <RefreshCw className="size-4" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className={cn(panelClassName, 'relative overflow-hidden p-7 sm:p-9')}>
            <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_45%)]" />

            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                <ShieldCheck className="size-3.5" />
                controle operacional premium
              </div>

              <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Estoque com leitura de risco,
                <span className="block text-muted-foreground">acoes rapidas e muito mais presenca.</span>
              </h2>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                A area mais sensivel da operacao agora comunica urgencia, estabilidade e poder
                de decisao em segundos.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    unidades disponiveis
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {stats.availableUnits}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    reservadas
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {stats.reservedUnits}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    total fisico
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {stats.currentUnits}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className={cn(panelClassName, 'p-6 sm:p-7')}>
              <SectionTitle
                eyebrow="alertas"
                title="Onde agir primeiro"
                description="Uma leitura direta do que esta saudavel, do que exige reposicao e do que ja entrou em ruptura."
              />

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                    <PackageCheck className="size-5" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
                    produtos saudaveis
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-emerald-50">
                    {stats.healthyProducts} item(ns) sem risco imediato
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-100">
                    <AlertTriangle className="size-5" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-100/70">
                    estoque baixo
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-amber-50">
                    {stockSummary?.low_stock_count || 0} item(ns) pedem reposicao
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4">
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-100">
                    <PackageX className="size-5" />
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em] text-rose-100/70">
                    ruptura
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-rose-50">
                    {stockSummary?.out_of_stock_count || 0} item(ns) sem saldo
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                icon={<Boxes className="size-5" />}
                label="produtos"
                value={`${stockSummary?.total_products || 0}`}
                hint="base total monitorada agora"
              />
              <MetricCard
                icon={<Layers3 className="size-5" />}
                label="disponiveis"
                value={`${filteredProducts.length}`}
                hint="itens exibidos pelos filtros atuais"
              />
            </div>
          </div>
        </section>

        <section className={cn(panelClassName, 'p-6 sm:p-7')}>
          <SectionTitle
            eyebrow="filtros"
            title="Encontre o ponto critico em segundos"
            description="Busque por produto, foque no risco certo e aplique ajustes com menos atrito."
          />

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar produto por nome..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={cn(controlClassName, 'pl-11')}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'ok', label: 'Saudaveis' },
                { id: 'low', label: 'Baixo' },
                { id: 'out', label: 'Ruptura' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setFilterStatus(option.id as 'all' | 'ok' | 'low' | 'out')
                  }
                  className={cn(
                    'rounded-2xl border px-4 py-2.5 text-sm font-medium transition',
                    filterStatus === option.id
                      ? 'border-accent/30 bg-accent/10 text-foreground'
                      : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:border-accent/20 hover:bg-white/[0.08] hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          {filteredProducts.length === 0 ? (
            <div className={cn(panelClassName, 'p-10 text-center')}>
              <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-accent">
                <PackageSearch className="size-6" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                Nenhum produto encontrado
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Ajuste a busca ou os filtros para reencontrar o item que voce quer operar.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const statusMeta = getStatusMeta(product.status);
                const adjustment = adjustments[product.id] || { quantity: '', reason: '' };
                const minStockValue =
                  minStockEdits[product.id] ?? (product.min_stock > 0 ? String(product.min_stock) : '');
                const isAdjusting = adjustingProduct === product.id;

                return (
                  <article
                    key={product.id}
                    className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6"
                  >
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r opacity-80',
                        statusMeta.card,
                      )}
                    />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-foreground">
                            {product.name}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            produto monitorado
                          </p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.16em]',
                            statusMeta.pill,
                          )}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            atual
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                            {product.current_stock}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            disponivel
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                            {product.available_stock}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            reservado
                          </p>
                          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                            {product.reserved_stock}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            minimo
                          </p>
                          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                            {product.min_stock}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleQuickAdjust(product.id, -1)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15"
                        >
                          <Minus className="size-4" />
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleQuickAdjust(product.id, 1)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                        >
                          <Plus className="size-4" />
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const opening = adjustingProduct !== product.id;
                            setAdjustingProduct(opening ? product.id : null);
                            if (opening) {
                              setAdjustments((previous) => ({
                                ...previous,
                                [product.id]:
                                  previous[product.id] || { quantity: '', reason: '' },
                              }));
                            }
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/20 hover:bg-white/[0.08]"
                        >
                          <PencilLine className="size-4" />
                          {isAdjusting ? 'Fechar' : 'Ajustar'}
                        </button>
                      </div>

                      {isAdjusting && (
                        <div className="mt-6 rounded-[28px] border border-white/10 bg-background/50 p-4">
                          <div className="space-y-4">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-foreground">
                                Ajuste manual
                              </label>
                              <input
                                type="number"
                                placeholder="Use positivo para entrada e negativo para saida"
                                value={adjustment.quantity}
                                onChange={(event) =>
                                  setAdjustments((previous) => ({
                                    ...previous,
                                    [product.id]: {
                                      ...adjustment,
                                      quantity: event.target.value,
                                    },
                                  }))
                                }
                                className={controlClassName}
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-foreground">
                                Motivo
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: inventario, avaria, reposicao..."
                                value={adjustment.reason}
                                onChange={(event) =>
                                  setAdjustments((previous) => ({
                                    ...previous,
                                    [product.id]: {
                                      ...adjustment,
                                      reason: event.target.value,
                                    },
                                  }))
                                }
                                className={controlClassName}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const quantity = parseInt(adjustment.quantity, 10);
                                if (!Number.isFinite(quantity) || quantity === 0) {
                                  toast.error('Digite uma quantidade valida.');
                                  return;
                                }

                                void handleAdjustStock(
                                  product.id,
                                  quantity,
                                  adjustment.reason || undefined,
                                );
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                            >
                              <Save className="size-4" />
                              Confirmar ajuste
                            </button>

                            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                              <label className="mb-2 block text-sm font-medium text-foreground">
                                Estoque minimo
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="Ex: 5"
                                  value={minStockValue}
                                  onChange={(event) =>
                                    setMinStockEdits((previous) => ({
                                      ...previous,
                                      [product.id]: event.target.value,
                                    }))
                                  }
                                  className={cn(controlClassName, 'flex-1')}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const value = parseInt(minStockValue || '0', 10);
                                    if (!Number.isFinite(value) || value < 0) {
                                      toast.error('Digite um minimo valido.');
                                      return;
                                    }

                                    void handleSetMinStock(product.id, value);
                                  }}
                                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
                                >
                                  <Save className="size-4" />
                                  Salvar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
