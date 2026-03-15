'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
import {
  ArrowRight,
  Boxes,
  ChartColumnIncreasing,
  CircleDollarSign,
  CheckCircle2,
  Compass,
  LogOut,
  PackagePlus,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { getDevCredentials, hasDevCredentials } from '@/lib/config';

interface Product {
  id: string;
  name: string;
  price: string;
  description?: string;
  is_active: boolean;
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  total_amount: string;
  created_at: string;
  channel?: string;
}

interface SalesReport {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  salesByChannel: Record<string, number>;
  ordersByStatus: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number; revenue: number; rank: number }>;
  salesByPeriod: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  salesByDay: Array<{ date: string; value: number }>;
  recentOrders: Order[];
}

interface StockOverview {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';
const controlClassName =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/10';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatChannel(channel?: string) {
  const labels: Record<string, string> = {
    pdv: 'PDV',
    ecommerce: 'E-commerce',
    whatsapp: 'WhatsApp',
  };

  return channel ? labels[channel] || channel : 'Canal nao informado';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente_pagamento: 'Pendente pagamento',
    confirmado: 'Confirmado',
    em_producao: 'Em producao',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };

  return labels[status] || status;
}

function getStatusTone(status: string) {
  const tones: Record<string, string> = {
    pendente_pagamento: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    confirmado: 'border-sky-300/20 bg-sky-300/10 text-sky-100',
    em_producao: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    pronto: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    entregue: 'border-white/10 bg-white/[0.05] text-foreground',
    cancelado: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  };

  return tones[status] || 'border-white/10 bg-white/[0.05] text-foreground';
}

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

function JourneyCard({
  icon,
  eyebrow,
  title,
  description,
  status,
  tone,
  meta,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  tone: string;
  meta: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
          {icon}
        </div>
        <span
          className={cn(
            'rounded-full border px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.18em]',
            tone,
          )}
        >
          {status}
        </span>
      </div>

      <p className="mt-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{meta}</span>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
        >
          {actionLabel}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </article>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const catalogSectionRef = useRef<HTMLElement | null>(null);
  const { user, tenantId, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    description: '',
  });

  const deferredProductSearch = useDeferredValue(productSearch);

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

  const { data: productsData, mutate: mutateProducts } = useSWR<Product[]>(
    tenantId ? `products:${tenantId}` : null,
    () => api.getProducts(tenantId!),
    { refreshInterval: 10000, revalidateOnFocus: true },
  );

  const { data: salesReport, error, isLoading, mutate: mutateSalesReport } = useSWR<SalesReport>(
    tenantId ? `sales-report:${tenantId}` : null,
    () => api.getSalesReport(tenantId!),
    { refreshInterval: 30000, revalidateOnFocus: true },
  );

  const { data: stockOverview, mutate: mutateStockOverview } = useSWR<StockOverview>(
    tenantId ? `stock-summary:${tenantId}` : null,
    () => api.getStockSummary(tenantId!),
    { refreshInterval: 30000, revalidateOnFocus: true },
  );

  useEffect(() => {
    if (!error) return;
    const message = error instanceof Error ? error.message : String(error);
    toast.error(message || 'Erro ao carregar relatorio de vendas');
  }, [error]);

  const products = useMemo(() => productsData || [], [productsData]);
  const filteredProducts = useMemo(() => {
    const query = deferredProductSearch.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.description || '').toLowerCase().includes(query)
      );
    });
  }, [deferredProductSearch, products]);

  const dominantChannel = useMemo(() => {
    const entries = Object.entries(salesReport?.salesByChannel || {});
    if (entries.length === 0) return null;
    const [channel, value] = entries.sort((a, b) => b[1] - a[1])[0];
    return { channel, value };
  }, [salesReport?.salesByChannel]);

  const maxSalesValue = useMemo(
    () => salesReport?.salesByDay.reduce((max, day) => Math.max(max, day.value), 0) || 0,
    [salesReport?.salesByDay],
  );

  const operationsInFlight = useMemo(() => {
    const ordersByStatus = salesReport?.ordersByStatus || {};
    return (
      (ordersByStatus.pendente_pagamento || 0) +
      (ordersByStatus.confirmado || 0) +
      (ordersByStatus.em_producao || 0) +
      (ordersByStatus.pronto || 0)
    );
  }, [salesReport?.ordersByStatus]);

  const activeProductsCount = products.filter((product) => product.is_active).length;
  const inactiveProductsCount = products.length - activeProductsCount;
  const welcomeName =
    user?.full_name?.trim().split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'gestor';
  const workspaceLabel = tenantId ? `${tenantId.slice(0, 8)}...${tenantId.slice(-4)}` : 'nao identificado';
  const totalOrdersCount = salesReport?.totalOrders || 0;
  const ecommerceSales = salesReport?.salesByChannel?.ecommerce || 0;
  const stockIssuesCount =
    (stockOverview?.low_stock_count || 0) + (stockOverview?.out_of_stock_count || 0);
  const stockReady = Boolean(stockOverview?.total_products) && stockIssuesCount === 0;

  const jumpToCatalog = () => {
    setShowAddProduct(true);
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openStock = () => router.push('/admin/estoque');
  const openPDV = () => router.push('/pdv');
  const openStorefront = () => router.push('/loja');
  const handleJourneyAction = (actionKey: string) => {
    switch (actionKey) {
      case 'catalog':
        jumpToCatalog();
        break;
      case 'stock':
        openStock();
        break;
      case 'pdv':
        openPDV();
        break;
      case 'storefront':
        openStorefront();
        break;
      default:
        break;
    }
  };

  const onboardingSteps = [
    {
      key: 'catalog',
      icon: <PackagePlus className="size-4" />,
      eyebrow: 'catalogo vivo',
      title: activeProductsCount > 0 ? 'Catalogo premium ativado' : 'Cadastre os primeiros produtos',
      description:
        activeProductsCount > 0
          ? `${activeProductsCount} produto(s) ativos ja alimentam a experiencia da loja, do PDV e do comando central.`
          : 'Comece pelo mix principal do negocio e transforme o catalogo em uma fonte unica de venda para todos os canais.',
      status: activeProductsCount > 0 ? 'Concluido' : 'Prioridade',
      tone: activeProductsCount > 0
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
      meta:
        activeProductsCount > 0
          ? `${inactiveProductsCount} produto(s) ainda pedem curadoria fina.`
          : 'Abra o formulario premium e publique o item mais importante primeiro.',
      actionLabel: activeProductsCount > 0 ? 'Refinar catalogo' : 'Adicionar produto',
      complete: activeProductsCount > 0,
    },
    {
      key: 'stock',
      icon: <Boxes className="size-4" />,
      eyebrow: 'estoque inteligente',
      title: stockReady ? 'Estoque sem alertas criticos' : 'Revise o pulso do estoque',
      description:
        stockReady
          ? 'O estoque esta alinhado com a operacao e pronto para sustentar a venda com mais serenidade.'
          : 'Entre na visao de estoque para eliminar ruptura, revisar minimo e ajustar os pontos de atencao.',
      status: stockReady ? 'Saudavel' : stockIssuesCount > 0 ? 'Atencao' : 'Monitorar',
      tone: stockReady
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : stockIssuesCount > 0
          ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
          : 'border-white/10 bg-white/[0.05] text-foreground',
      meta:
        stockIssuesCount > 0
          ? `${stockIssuesCount} alerta(s) esperam a sua decisao.`
          : 'Use a inteligencia de estoque para blindar a experiencia do cliente.',
      actionLabel: 'Abrir estoque',
      complete: stockReady,
    },
    {
      key: 'pdv',
      icon: <Rocket className="size-4" />,
      eyebrow: 'ritmo operacional',
      title: totalOrdersCount > 0 ? 'PDV ja ganhou tracao' : 'Simule a primeira venda',
      description:
        totalOrdersCount > 0
          ? `${totalOrdersCount} pedido(s) ja passaram pela operacao e validam o fluxo de atendimento.`
          : 'Abra o PDV, monte um carrinho e sinta a fluidez da venda presencial antes do cliente real entrar.',
      status: totalOrdersCount > 0 ? 'Rodando' : 'Simular',
      tone: totalOrdersCount > 0
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : 'border-white/10 bg-white/[0.05] text-foreground',
      meta:
        totalOrdersCount > 0
          ? 'A jornada de caixa ja esta em movimento.'
          : 'Uma venda-teste ajuda a lapidar o ritual da equipe.',
      actionLabel: 'Abrir PDV',
      complete: totalOrdersCount > 0,
    },
    {
      key: 'storefront',
      icon: <Compass className="size-4" />,
      eyebrow: 'vitrine que emociona',
      title: ecommerceSales > 0 ? 'A loja ja esta convertendo' : 'Reveja a loja como cliente',
      description:
        ecommerceSales > 0
          ? `${formatCurrency(ecommerceSales)} ja vieram do e-commerce, provando que a vitrine esta respirando valor.`
          : 'Passeie pela loja premium, valide a narrativa visual e ajuste o que ainda nao estiver arrebatador.',
      status: ecommerceSales > 0 ? 'Em venda' : activeProductsCount > 0 ? 'Pronta' : 'Preparar',
      tone: ecommerceSales > 0
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : activeProductsCount > 0
          ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
          : 'border-white/10 bg-white/[0.05] text-foreground',
      meta:
        ecommerceSales > 0
          ? 'A frente digital ja devolve resultado mensuravel.'
          : 'A vitrine e o reflexo emocional da sua marca para o cliente.',
      actionLabel: 'Ver loja',
      complete: ecommerceSales > 0,
    },
  ];

  const completedJourneySteps = onboardingSteps.filter((step) => step.complete).length;
  const onboardingProgress = Math.round(
    (completedJourneySteps / onboardingSteps.length) * 100,
  );
  const nextJourneyStep =
    onboardingSteps.find((step) => !step.complete) || onboardingSteps[onboardingSteps.length - 1];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleRefresh = async () => {
    await Promise.all([mutateSalesReport(), mutateProducts(), mutateStockOverview()]);
    toast.success('Dashboard atualizado.');
  };

  const handleAddProduct = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (!tenantId) {
        toast.error('Tenant ID nao disponivel. Faca login novamente.');
        return;
      }

      await api.createProduct(newProduct, tenantId);
      setNewProduct({ name: '', price: '', description: '' });
      setShowAddProduct(false);
      toast.success('Produto criado com sucesso.');
      await mutateProducts();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar produto');
    }
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
              carregando command center
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
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-35px_rgba(16,185,129,0.9)]">
              <Store className="size-5 text-accent" />
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
                command center
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Dashboard Admin
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
              onClick={() => router.push('/admin/estoque')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
            >
              <Boxes className="size-4" />
              Estoque
            </button>
            <button
              type="button"
              onClick={() => setShowOnboarding((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
            >
              <Sparkles className="size-4" />
              {showOnboarding ? 'Ocultar onboarding' : 'Mostrar onboarding'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {showOnboarding && (
          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className={cn(panelClassName, 'relative overflow-hidden p-7 sm:p-9')}>
              <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_55%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_42%)]" />

              <div className="relative">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                  <Sparkles className="size-3.5" />
                  onboarding premium pos-login
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      bem-vindo de volta, {welcomeName}
                    </p>
                    <h2 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                      Vamos transformar este workspace em uma operacao que arranca confianca no primeiro minuto.
                    </h2>
                    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                      O command center ja esta bonito. Agora a trilha abaixo organiza os
                      fundamentos que fazem a plataforma parecer inevitavelmente premium para
                      sua equipe e para o seu cliente.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOnboarding(false)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                  >
                    Ocultar guia
                  </button>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      workspace ativo
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                      {workspaceLabel}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {user?.email || 'Operador principal conectado ao ecossistema.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      fase da operacao
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                      {totalOrdersCount > 0 ? 'Em movimento' : 'Estruturacao guiada'}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {nextJourneyStep.title}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      progresso da jornada
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="text-2xl font-semibold tracking-tight text-foreground">
                        {completedJourneySteps}/{onboardingSteps.length}
                      </p>
                      <span className="text-sm font-medium text-accent">{onboardingProgress}% pronto</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-300"
                        style={{ width: `${Math.max(onboardingProgress, 8)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleJourneyAction(nextJourneyStep.key)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    {nextJourneyStep.actionLabel}
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openPDV}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                  >
                    <Rocket className="size-4" />
                    Abrir PDV
                  </button>
                  <button
                    type="button"
                    onClick={openStorefront}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                  >
                    <Compass className="size-4" />
                    Ver loja
                  </button>
                </div>
              </div>
            </div>

            <div className={cn(panelClassName, 'p-6 sm:p-7')}>
              <SectionTitle
                eyebrow="primeiros 5 minutos"
                title="Trilha de ativacao da operacao"
                description="Cada passo abaixo foi pensado para transformar o primeiro acesso em confianca, criterio e momentum real."
                action={
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">
                    <CheckCircle2 className="size-3.5" />
                    {completedJourneySteps} fundamento(s) alinhado(s)
                  </div>
                }
              />

              <div className="mt-6 grid gap-4">
                {onboardingSteps.map((step) => (
                  <JourneyCard
                    key={step.key}
                    icon={step.icon}
                    eyebrow={step.eyebrow}
                    title={step.title}
                    description={step.description}
                    status={step.status}
                    tone={step.tone}
                    meta={step.meta}
                    actionLabel={step.actionLabel}
                    onAction={() => handleJourneyAction(step.key)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

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
                    {formatCurrency(salesReport?.salesByPeriod.thisMonth || 0)}
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
              <SectionTitle
                eyebrow="leitura rapida"
                title="O que importa agora"
                description="Um retrato rapido do que esta puxando a operacao para cima e do que merece atencao imediata."
              />

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

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                icon={<CircleDollarSign className="size-5" />}
                label="vendas totais"
                value={formatCurrency(salesReport?.totalSales || 0)}
                hint={`${salesReport?.totalOrders || 0} pedidos acumulados`}
              />
              <MetricCard
                icon={<WalletCards className="size-5" />}
                label="ticket medio"
                value={formatCurrency(salesReport?.avgTicket || 0)}
                hint="mais contexto para precificacao e combos"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<TrendingUp className="size-5" />}
            label="vendas hoje"
            value={formatCurrency(salesReport?.salesByPeriod.today || 0)}
            hint="ultimo ciclo de 24h"
          />
          <MetricCard
            icon={<ChartColumnIncreasing className="size-5" />}
            label="semana"
            value={formatCurrency(salesReport?.salesByPeriod.thisWeek || 0)}
            hint="ritmo operacional dos ultimos dias"
          />
          <MetricCard
            icon={<ShoppingBag className="size-5" />}
            label="pedidos"
            value={`${salesReport?.totalOrders || 0}`}
            hint="volume total da base atual"
          />
          <MetricCard
            icon={<Boxes className="size-5" />}
            label="portfolio"
            value={`${products.length}`}
            hint="produtos cadastrados na operacao"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={cn(panelClassName, 'p-6 sm:p-7')}>
            <SectionTitle
              eyebrow="movimento comercial"
              title="Vendas nos ultimos dias"
              description="A leitura visual agora ajuda a perceber rapidamente onde a operacao acelerou ou esfriou."
            />

            {salesReport?.salesByDay && salesReport.salesByDay.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-7">
                {salesReport.salesByDay.map((day, index) => {
                  const height = maxSalesValue > 0 ? (day.value / maxSalesValue) * 100 : 0;
                  return (
                    <div key={`${day.date}-${index}`} className="flex flex-col items-center gap-3">
                      <div className="flex h-56 w-full items-end rounded-[26px] border border-white/10 bg-white/[0.04] p-3">
                        <div
                          className="w-full rounded-[18px] bg-gradient-to-t from-accent to-cyan-300 transition-all duration-500"
                          style={{ height: `${Math.max(height, 10)}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {formatShortDate(day.date)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatCurrency(day.value)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-8 rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-muted-foreground">
                Sem dados suficientes para desenhar a curva de vendas.
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className={cn(panelClassName, 'p-6 sm:p-7')}>
              <SectionTitle
                eyebrow="mix de canais"
                title="Quem esta puxando receita"
                description="Canal lider, distribuicao e participacao financeira lado a lado."
              />

              <div className="mt-6 space-y-4">
                {Object.entries(salesReport?.salesByChannel || {}).length > 0 ? (
                  Object.entries(salesReport?.salesByChannel || {}).map(([channel, value]) => {
                    const total = salesReport?.totalSales || 1;
                    const percentage = (value / total) * 100;

                    return (
                      <div
                        key={channel}
                        className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {formatChannel(channel)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatCurrency(value)} em vendas
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
                    Os canais vao aparecer aqui assim que as vendas forem registradas.
                  </div>
                )}
              </div>
            </div>

            <div className={cn(panelClassName, 'p-6 sm:p-7')}>
              <SectionTitle
                eyebrow="pipeline"
                title="Pedidos por status"
                description="Uma visao limpa do que esta parado, avancando ou finalizado."
              />

              <div className="mt-6 space-y-3">
                {Object.entries(salesReport?.ordersByStatus || {}).length > 0 ? (
                  Object.entries(salesReport?.ordersByStatus || {}).map(([status, value]) => {
                    const total = salesReport?.totalOrders || 1;
                    const percentage = (value / total) * 100;

                    return (
                      <div
                        key={status}
                        className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-foreground">
                            {getStatusLabel(status)}
                          </span>
                          <span className="text-sm font-semibold text-foreground">{value}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
                    Ainda sem pedidos para distribuir por status.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className={cn(panelClassName, 'p-6 sm:p-7')}>
            <SectionTitle
              eyebrow="performance"
              title="Top produtos"
              description="Os campeoes de giro aparecem com mais presenca e contexto comercial."
            />

            <div className="mt-6 space-y-3">
              {salesReport?.topProducts && salesReport.topProducts.length > 0 ? (
                salesReport.topProducts.map((product) => (
                  <div
                    key={`${product.rank}-${product.name}`}
                    className="flex items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-sm font-semibold text-accent">
                        {product.rank}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {product.quantity} unidades vendidas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(product.revenue)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        receita
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
                  Os produtos mais vendidos vao aparecer aqui assim que a operacao ganhar ritmo.
                </div>
              )}
            </div>
          </div>

          <div className={cn(panelClassName, 'p-6 sm:p-7')}>
            <SectionTitle
              eyebrow="operacao"
              title="Pedidos recentes"
              description="Ultimos movimentos da base, com valor, canal e status mais legiveis."
            />

            <div className="mt-6 space-y-3">
              {salesReport?.recentOrders && salesReport.recentOrders.length > 0 ? (
                salesReport.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-mono text-sm font-medium text-foreground">
                          {order.order_no}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatShortDate(order.created_at)} - {formatChannel(order.channel)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em]',
                            getStatusTone(order.status),
                          )}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(Number(order.total_amount))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
                  Nenhum pedido encontrado ainda.
                </div>
              )}
            </div>
          </div>
        </section>

        <section ref={catalogSectionRef} className={cn(panelClassName, 'p-6 sm:p-7')}>
          <SectionTitle
            eyebrow="catalogo"
            title={`Produtos cadastrados (${products.length})`}
            description="Pesquisa rapida, leitura visual mais limpa e um fluxo melhor para inserir novos produtos."
            action={
              <button
                type="button"
                onClick={() => setShowAddProduct((current) => !current)}
                className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
              >
                <PackagePlus className="size-4" />
                {showAddProduct ? 'Fechar formulario' : 'Adicionar produto'}
              </button>
            }
          />

          {showAddProduct && (
            <form
              onSubmit={handleAddProduct}
              className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Nome</label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(event) =>
                      setNewProduct({ ...newProduct, name: event.target.value })
                    }
                    required
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Preco</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(event) =>
                      setNewProduct({ ...newProduct, price: event.target.value })
                    }
                    required
                    className={controlClassName}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Descricao
                  </label>
                  <textarea
                    value={newProduct.description}
                    onChange={(event) =>
                      setNewProduct({ ...newProduct, description: event.target.value })
                    }
                    rows={3}
                    className={controlClassName}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
              >
                <PackagePlus className="size-4" />
                Criar produto
              </button>
            </form>
          )}

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Buscar produto por nome ou descricao..."
                className={cn(controlClassName, 'pl-11')}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {activeProductsCount} ativos
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {inactiveProductsCount} inativos
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {filteredProducts.length} exibidos
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
                Nenhum produto encontrado para essa busca.
              </div>
            ) : (
              filteredProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div
                    className={cn(
                      'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-80',
                      index % 2 === 0
                        ? 'from-sky-400/12 via-cyan-400/8 to-transparent'
                        : 'from-emerald-400/12 via-amber-300/8 to-transparent',
                    )}
                  />

                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                        {product.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          {product.description || 'Produto pronto para venda nos canais conectados.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          preco
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatCurrency(parseFloat(product.price))}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em]',
                          product.is_active
                            ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                            : 'border-rose-300/20 bg-rose-300/10 text-rose-100',
                        )}
                      >
                        {product.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
