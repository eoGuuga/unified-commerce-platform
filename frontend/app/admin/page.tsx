'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
import {
  Boxes,
  ChartColumnIncreasing,
  CircleDollarSign,
  Compass,
  PackagePlus,
  Rocket,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import api from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { getDevCredentials, hasDevCredentials } from '@/lib/config';
import { formatCurrency } from '@/lib/format';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { OnboardingPanel } from '@/components/admin/OnboardingPanel';
import { SalesOverviewPanel } from '@/components/admin/SalesOverviewPanel';
import { MetricCard } from '@/components/admin/MetricCard';
import { SalesChart } from '@/components/admin/SalesChart';
import { ChannelBreakdown } from '@/components/admin/ChannelBreakdown';
import { OrdersPipeline } from '@/components/admin/OrdersPipeline';
import { TopProducts } from '@/components/admin/TopProducts';
import { RecentOrders } from '@/components/admin/RecentOrders';
import { ProductCatalog } from '@/components/admin/ProductCatalog';

interface Product {
  id: string;
  name: string;
  price: string | number;
  description?: string;
  is_active: boolean;
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
  recentOrders: Array<{
    id: string;
    order_no: string;
    status: string;
    total_amount: string;
    created_at: string;
    channel?: string;
  }>;
}

interface StockOverview {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
}
export default function AdminDashboard() {
  const router = useRouter();
  const catalogSectionRef = useRef<HTMLElement | null>(null);
  const { user, tenantId, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(true);

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

  const { data: productsData, mutate: mutateProducts } = useSWR(
    tenantId ? `products:${tenantId}` : null,
    () => api.getProducts(tenantId!),
    { refreshInterval: 10000, revalidateOnFocus: true },
  );

  const { data: salesReport, error, isLoading, mutate: mutateSalesReport } = useSWR(
    tenantId ? `sales-report:${tenantId}` : null,
    () => api.getSalesReport(tenantId!),
    { refreshInterval: 30000, revalidateOnFocus: true },
  );

  const { data: stockOverview, mutate: mutateStockOverview } = useSWR(
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
    catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openStock = () => router.push('/admin/estoque');
  const openPDV = () => router.push('/pdv');
  const openStorefront = () => router.push('/loja');

  const handleJourneyAction = (actionKey: string) => {
    switch (actionKey) {
      case 'catalog': jumpToCatalog(); break;
      case 'stock': openStock(); break;
      case 'pdv': openPDV(); break;
      case 'storefront': openStorefront(); break;
    }
  };

  const onboardingSteps = [
    {
      key: 'catalog',
      icon: <PackagePlus className="size-4" />,
      eyebrow: 'catalogo vivo',
      title: activeProductsCount > 0 ? 'Catalogo premium ativado' : 'Cadastre os primeiros produtos',
      description: activeProductsCount > 0
        ? `${activeProductsCount} produto(s) ativos ja alimentam a experiencia da loja, do PDV e do comando central.`
        : 'Comece pelo mix principal do negocio e transforme o catalogo em uma fonte unica de venda para todos os canais.',
      status: activeProductsCount > 0 ? 'Concluido' : 'Prioridade',
      tone: activeProductsCount > 0
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
      meta: activeProductsCount > 0
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
      description: stockReady
        ? 'O estoque esta alinhado com a operacao e pronto para sustentar a venda com mais serenidade.'
        : 'Entre na visao de estoque para eliminar ruptura, revisar minimo e ajustar os pontos de atencao.',
      status: stockReady ? 'Saudavel' : stockIssuesCount > 0 ? 'Atencao' : 'Monitorar',
      tone: stockReady
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : stockIssuesCount > 0
          ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
          : 'border-white/10 bg-white/[0.05] text-foreground',
      meta: stockIssuesCount > 0
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
      description: totalOrdersCount > 0
        ? `${totalOrdersCount} pedido(s) ja passaram pela operacao e validam o fluxo de atendimento.`
        : 'Abra o PDV, monte um carrinho e sinta a fluidez da venda presencial antes do cliente real entrar.',
      status: totalOrdersCount > 0 ? 'Rodando' : 'Simular',
      tone: totalOrdersCount > 0
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : 'border-white/10 bg-white/[0.05] text-foreground',
      meta: totalOrdersCount > 0
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
      description: ecommerceSales > 0
        ? `${formatCurrency(ecommerceSales)} ja vieram do e-commerce, provando que a vitrine esta respirando valor.`
        : 'Passeie pela loja premium, valide a narrativa visual e ajuste o que ainda nao estiver arrebatador.',
      status: ecommerceSales > 0 ? 'Em venda' : activeProductsCount > 0 ? 'Pronta' : 'Preparar',
      tone: ecommerceSales > 0
        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
        : activeProductsCount > 0
          ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
          : 'border-white/10 bg-white/[0.05] text-foreground',
      meta: ecommerceSales > 0
        ? 'A frente digital ja devolve resultado mensuravel.'
        : 'A vitrine e o reflexo emocional da sua marca para o cliente.',
      actionLabel: 'Ver loja',
      complete: ecommerceSales > 0,
    },
  ];

  const completedJourneySteps = onboardingSteps.filter((step) => step.complete).length;
  const onboardingProgress = Math.round((completedJourneySteps / onboardingSteps.length) * 100);
  const nextJourneyStep = onboardingSteps.find((step) => !step.complete) || onboardingSteps[onboardingSteps.length - 1];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleRefresh = async () => {
    await Promise.all([mutateSalesReport(), mutateProducts(), mutateStockOverview()]);
    toast.success('Dashboard atualizado.');
  };

  const handleAddProduct = async (product: { name: string; price: string; description: string }) => {
    try {
      if (!tenantId) {
        toast.error('Tenant ID nao disponivel. Faca login novamente.');
        return;
      }
      await api.createProduct(product, tenantId);
      toast.success('Produto criado com sucesso.');
      await mutateProducts();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar produto');
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

      <AdminHeader
        showOnboarding={showOnboarding}
        onToggleOnboarding={() => setShowOnboarding((c) => !c)}
        onRefresh={() => void handleRefresh()}
        onOpenStock={openStock}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {showOnboarding && (
          <OnboardingPanel
            welcomeName={welcomeName}
            workspaceLabel={workspaceLabel}
            userEmail={user?.email}
            totalOrdersCount={totalOrdersCount}
            onboardingSteps={onboardingSteps}
            completedSteps={completedJourneySteps}
            onboardingProgress={onboardingProgress}
            nextStep={nextJourneyStep}
            onHide={() => setShowOnboarding(false)}
            onJourneyAction={handleJourneyAction}
            onOpenPDV={openPDV}
            onOpenStorefront={openStorefront}
          />
        )}

        <SalesOverviewPanel
          monthlyRevenue={salesReport?.salesByPeriod.thisMonth || 0}
          operationsInFlight={operationsInFlight}
          activeProductsCount={activeProductsCount}
          dominantChannel={dominantChannel}
          inactiveProductsCount={inactiveProductsCount}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SalesChart
            salesByDay={salesReport?.salesByDay || []}
            maxSalesValue={maxSalesValue}
          />
          <div className="space-y-6">
            <ChannelBreakdown
              salesByChannel={salesReport?.salesByChannel || {}}
              totalSales={salesReport?.totalSales || 0}
            />
            <OrdersPipeline
              ordersByStatus={salesReport?.ordersByStatus || {}}
              totalOrders={salesReport?.totalOrders || 0}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <TopProducts topProducts={salesReport?.topProducts || []} />
          <RecentOrders recentOrders={salesReport?.recentOrders || []} />
        </section>

        <ProductCatalog
          products={products}
          onAddProduct={handleAddProduct}
          sectionRef={catalogSectionRef}
        />
      </main>
    </div>
  );
}
