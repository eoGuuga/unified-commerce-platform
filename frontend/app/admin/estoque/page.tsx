'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
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

export default function EstoquePage() {
  const router = useRouter();
  const { tenantId, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'low' | 'out'>('all');
  const [adjustingProduct, setAdjustingProduct] = useState<string | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Auto-login (apenas em desenvolvimento)
  useEffect(() => {
    const autoLogin = async () => {
      if (typeof window === 'undefined' || authLoading) return;
      if (!isAuthenticated || !tenantId) {
        if (process.env.NODE_ENV === 'development' && hasDevCredentials()) {
          try {
            const devCreds = getDevCredentials();
            await login(devCreds.email, devCreds.password, devCreds.tenantId);
          } catch (err) {
            console.error('Erro no login automático:', err);
            toast.error('Erro ao fazer login automático. Verifique as credenciais.');
          }
        } else {
          toast.error('Autenticação necessária. Redirecionando para login...');
          router.push('/login');
        }
      }
    };
    autoLogin();
  }, [authLoading, isAuthenticated, tenantId, login, router]);

  // SWR para dados de estoque
  const { data: stockSummary, error, isLoading, mutate } = useSWR<StockSummary>(
    tenantId ? `stock-summary-${tenantId}` : null,
    async () => {
      if (!tenantId) return null;
      return api.getStockSummary(tenantId);
    },
    {
      refreshInterval: 5000, // Atualiza a cada 5 segundos
      revalidateOnFocus: true,
      onError: (err: any) => {
        console.error('Erro ao carregar estoque:', err);
        if (!err.message?.includes('401')) {
          toast.error('Erro ao carregar estoque. Verifique o console (F12).');
        }
      },
    },
  );

  // Filtrar produtos
  const filteredProducts = stockSummary?.products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || product.status === filterStatus;
    return matchesSearch && matchesFilter;
  }) || [];

  const handleAdjustStock = async (productId: string, quantity: number, reason?: string) => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível.');
      return;
    }
    try {
      await api.adjustStock(productId, quantity, tenantId, reason);
      toast.success(`Estoque ajustado com sucesso!`);
      setAdjustingProduct(null);
      setAdjustQuantity('');
      setAdjustReason('');
      await mutate(); // Revalidar dados
    } catch (error: any) {
      toast.error(error.message || 'Erro ao ajustar estoque');
    }
  };

  const handleQuickAdjust = async (productId: string, delta: number) => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível.');
      return;
    }
    try {
      await api.adjustStock(productId, delta, tenantId, `Ajuste rápido: ${delta > 0 ? '+' : ''}${delta}`);
      toast.success(`Estoque ajustado!`);
      await mutate();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao ajustar estoque');
    }
  };

  const getStatusColor = (status: 'ok' | 'low' | 'out') => {
    switch (status) {
      case 'ok':
        return 'bg-green-50 border-green-200';
      case 'low':
        return 'bg-yellow-50 border-yellow-200';
      case 'out':
        return 'bg-red-50 border-red-200';
    }
  };

  const getStatusBadge = (status: 'ok' | 'low' | 'out') => {
    switch (status) {
      case 'ok':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">OK</span>;
      case 'low':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">BAIXO</span>;
      case 'out':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">SEM ESTOQUE</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando estoque...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Voltar
            </button>
            <h1 className="text-2xl font-bold">Gestão de Estoque</h1>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Total de Produtos</div>
            <div className="text-3xl font-bold text-blue-600">{stockSummary?.total_products || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Estoque OK</div>
            <div className="text-3xl font-bold text-green-600">
              {(stockSummary?.total_products || 0) - (stockSummary?.low_stock_count || 0) - (stockSummary?.out_of_stock_count || 0)}
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6 border-2 border-yellow-200">
            <div className="text-sm text-yellow-700 mb-2 font-medium">⚠️ Estoque Baixo</div>
            <div className="text-3xl font-bold text-yellow-700">{stockSummary?.low_stock_count || 0}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-6 border-2 border-red-200">
            <div className="text-sm text-red-700 mb-2 font-medium">🚨 Sem Estoque</div>
            <div className="text-3xl font-bold text-red-700">{stockSummary?.out_of_stock_count || 0}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus('low')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filterStatus === 'low'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Baixo
              </button>
              <button
                onClick={() => setFilterStatus('out')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filterStatus === 'out'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Sem Estoque
              </button>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className={`bg-white rounded-lg shadow p-6 border-2 ${getStatusColor(product.status)}`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
                {getStatusBadge(product.status)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Estoque Atual:</span>
                  <span className="font-semibold">{product.current_stock}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Reservado:</span>
                  <span className="font-semibold text-orange-600">{product.reserved_stock}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Disponível:</span>
                  <span className="font-semibold text-green-600">{product.available_stock}</span>
                </div>
                {product.min_stock > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mínimo:</span>
                    <span className="font-semibold">{product.min_stock}</span>
                  </div>
                )}
              </div>

              {/* Quick Adjust Buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => handleQuickAdjust(product.id, -1)}
                  className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                >
                  -1
                </button>
                <button
                  onClick={() => handleQuickAdjust(product.id, +1)}
                  className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
                >
                  +1
                </button>
                <button
                  onClick={() => setAdjustingProduct(adjustingProduct === product.id ? null : product.id)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                >
                  {adjustingProduct === product.id ? 'Cancelar' : 'Ajustar'}
                </button>
              </div>

              {/* Manual Adjust Form */}
              {adjustingProduct === product.id && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="space-y-2">
                    <input
                      type="number"
                      placeholder="Quantidade (ex: +10 ou -5)"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Motivo (opcional)"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        const qty = parseInt(adjustQuantity);
                        if (!isNaN(qty)) {
                          handleAdjustStock(product.id, qty, adjustReason || undefined);
                        } else {
                          toast.error('Digite uma quantidade válida');
                        }
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Confirmar Ajuste
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">
              {searchQuery || filterStatus !== 'all'
                ? 'Nenhum produto encontrado com os filtros aplicados'
                : 'Nenhum produto cadastrado'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
