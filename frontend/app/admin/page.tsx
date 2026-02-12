'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
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

export default function AdminDashboard() {
  const router = useRouter();
  const { tenantId, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    description: '',
  });

  // ✅ CRÍTICO: Auto-login APENAS em desenvolvimento e se explicitamente habilitado
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
          } catch (err) {
            console.error('[DEV] Erro no login automático:', err);
            toast.error('Erro ao fazer login automático. Verifique as credenciais.');
          }
        } else {
          // Em produção ou se não habilitado, redirecionar para login
          toast.error('Autenticação necessária. Redirecionando para login...');
          router.push('/login');
        }
      }
    };
    autoLogin();
  }, [authLoading, isAuthenticated, tenantId, login, router]);

  // SWR para produtos
  const { data: productsData, mutate: mutateProducts } = useSWR<Product[]>(
    tenantId ? `products:${tenantId}` : null,
    () => api.getProducts(tenantId!),
    { refreshInterval: 10000, revalidateOnFocus: true },
  );

  // SWR para relatório de vendas
  const { data: salesReport, error, isLoading } = useSWR<SalesReport>(
    tenantId ? `sales-report:${tenantId}` : null,
    () => api.getSalesReport(tenantId!),
    { refreshInterval: 30000, revalidateOnFocus: true },
  );

  useEffect(() => {
    if (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || 'Erro ao carregar relatorio de vendas');
    }
  }, [error]);

  const products = productsData || [];

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!tenantId) {
        toast.error('Tenant ID não disponível. Faça login novamente.');
        return;
      }
      await api.createProduct(newProduct, tenantId);
      setNewProduct({ name: '', price: '', description: '' });
      setShowAddProduct(false);
      toast.success('Produto criado com sucesso!');
      await mutateProducts();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar produto');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pendente_pagamento: 'bg-amber-100 text-amber-800',
      confirmado: 'bg-blue-100 text-blue-800',
      em_producao: 'bg-teal-100 text-teal-800',
      pronto: 'bg-green-100 text-green-800',
      entregue: 'bg-gray-100 text-gray-800',
      cancelado: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const getChannelLabel = (channel?: string) => {
    const labels: Record<string, string> = {
      pdv: 'PDV',
      ecommerce: 'E-commerce',
      whatsapp: 'WhatsApp',
    };
    return channel ? labels[channel] || channel : 'N/A';
  };

  // Calcular altura máxima do gráfico
  const maxSalesValue = salesReport?.salesByDay.reduce((max, day) => Math.max(max, day.value), 0) || 0;

  if (isLoading) {
    return (
      <div className="app-shell full-bleed flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-200">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard Admin</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin/estoque')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              📦 Gestão de Estoque
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 py-8">
        <div className="space-y-6">
          {/* Main Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Total de Vendas</div>
              <div className="text-3xl font-bold">{formatCurrency(salesReport?.totalSales || 0)}</div>
              <div className="text-sm opacity-75 mt-2">{salesReport?.totalOrders || 0} pedidos</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Ticket Médio</div>
              <div className="text-3xl font-bold">{formatCurrency(salesReport?.avgTicket || 0)}</div>
              <div className="text-sm opacity-75 mt-2">por pedido</div>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-emerald-500 rounded-lg shadow-lg p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Vendas Hoje</div>
              <div className="text-3xl font-bold">{formatCurrency(salesReport?.salesByPeriod?.today || 0)}</div>
              <div className="text-sm opacity-75 mt-2">últimas 24h</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
              <div className="text-sm opacity-90 mb-2">Vendas do Mês</div>
              <div className="text-3xl font-bold">{formatCurrency(salesReport?.salesByPeriod?.thisMonth || 0)}</div>
              <div className="text-sm opacity-75 mt-2">este mês</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Chart - Last 7 Days */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Vendas (Últimos 7 Dias)</h2>
              {salesReport?.salesByDay && salesReport.salesByDay.length > 0 ? (
                <div className="h-64 flex items-end justify-between gap-2">
                  {salesReport.salesByDay.map((day, index) => {
                    const height = maxSalesValue > 0 ? (day.value / maxSalesValue) * 100 : 0;
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-gray-200 rounded-t relative" style={{ height: '200px' }}>
                          <div
                            className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-500"
                            style={{ height: `${height}%` }}
                          >
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">
                              {formatCurrency(day.value)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 text-center">
                          {formatDate(day.date)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Sem dados suficientes
                </div>
              )}
            </div>

            {/* Sales by Channel */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Vendas por Canal</h2>
              <div className="space-y-4">
                {Object.entries(salesReport?.salesByChannel || {}).map(([channel, value]) => {
                  const total = salesReport?.totalSales || 1;
                  const percentage = (value / total) * 100;
                  const channelNames: Record<string, string> = {
                    pdv: 'PDV',
                    ecommerce: 'E-commerce',
                    whatsapp: 'WhatsApp',
                  };
                  return (
                    <div key={channel}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {channelNames[channel] || channel}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(value)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% do total</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Products & Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold">Top 10 Produtos Mais Vendidos</h2>
              </div>
              <div className="p-6">
                {salesReport?.topProducts && salesReport.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {salesReport.topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {product.rank}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">
                              {product.quantity} unidades vendidas
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">{formatCurrency(product.revenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Nenhuma venda ainda</p>
                )}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold">Pedidos Recentes</h2>
              </div>
              <div className="p-6">
                {salesReport?.recentOrders && salesReport.recentOrders.length > 0 ? (
                  <div className="space-y-3">
                    {salesReport.recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-mono text-sm font-medium text-gray-900">{order.order_no}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(order.created_at)} • {getChannelLabel(order.channel)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">{formatCurrency(Number(order.total_amount))}</div>
                          <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Nenhum pedido encontrado</p>
                )}
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">Produtos ({products.length})</h2>
              <button
                onClick={() => setShowAddProduct(!showAddProduct)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showAddProduct ? 'Cancelar' : '+ Adicionar Produto'}
              </button>
            </div>

            {showAddProduct && (
              <form onSubmit={handleAddProduct} className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                    <input
                      type="text"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preço</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
                    <textarea
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Criar Produto
                </button>
              </form>
            )}

            <div className="p-6">
              {products.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum produto cadastrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4">Nome</th>
                        <th className="text-left py-3 px-4">Preço</th>
                        <th className="text-left py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">{product.name}</td>
                          <td className="py-3 px-4 font-medium">{formatCurrency(parseFloat(product.price))}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded text-sm ${
                                product.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {product.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
