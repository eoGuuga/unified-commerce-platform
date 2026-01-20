'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
import api from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { getDevCredentials, hasDevCredentials } from '@/lib/config';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock?: number;
}

interface Product {
  id: string;
  name: string;
  price: string;
  description?: string;
  is_active: boolean;
  stock?: number;
  min_stock?: number;
}

interface Order {
  id: string;
  total_amount: number;
  created_at: string;
}

type PaymentMethod = 'pix' | 'dinheiro';

interface PaymentResult {
  pagamento: {
    id: string;
    status: string;
    method: PaymentMethod;
    amount: number | string;
    metadata?: Record<string, unknown>;
  };
  qr_code?: string;
  qr_code_url?: string;
  copy_paste?: string;
  message?: string;
}

// ⚠️ REMOVIDO: TENANT_ID hardcoded - deve vir do contexto JWT
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Fetchers para SWR
const productsFetcher = async (tenantId: string) => {
  try {
    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório');
    }
    console.log('🔄 Buscando produtos para tenant:', tenantId);
    const products = await api.getProducts(tenantId);
    console.log('✅ Fetcher retornou:', products?.length || 0, 'produtos');
    if (products && products.length > 0) {
      console.log('📦 Exemplos:', products.slice(0, 3).map((p: Product) => ({ name: p.name, stock: p.stock })));
    } else {
      console.warn('⚠️ Nenhum produto retornado. Verifique se produtos foram cadastrados.');
    }
    return Array.isArray(products) ? products : [];
  } catch (error: any) {
    console.error('❌ Erro no fetcher de produtos:', error);
    // Não fazer login automático aqui - deixar o hook useAuth gerenciar
    console.warn('⚠️ Retornando array vazio devido ao erro');
    return [];
  }
};

const ordersFetcher = async (tenantId: string) => {
  try {
    return await api.getOrders(tenantId);
  } catch (error: any) {
    // Se for erro de autenticação, retornar array vazio silenciosamente
    if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
      console.warn('⚠️ Erro de autenticação ao buscar pedidos (normal se token expirou)');
      return [];
    }
    console.error('Erro ao buscar pedidos:', error);
    return [];
  }
};

// Debounce function
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function PDVPage() {
  const router = useRouter();
  const { user, tenantId, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSelling, setIsSelling] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [cashReceived, setCashReceived] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<{ id: string; total: number; orderNo?: string } | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentResult | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // SWR para produtos - configurado para atualização quase em tempo real
  // ⚠️ CRÍTICO: tenantId deve vir do contexto JWT, nunca hardcoded
  const swrKey = mounted && tenantId ? `products:${tenantId}` : null;
  const { data: products = [], error, isLoading, mutate } = useSWR<Product[]>(
    swrKey, // Só buscar quando montado e tenantId disponível
    () => productsFetcher(tenantId!),
    {
      refreshInterval: 3000, // Atualiza a cada 3 segundos para quase tempo real
      revalidateOnFocus: true, // Revalidar ao focar para garantir dados atualizados
      revalidateOnReconnect: true,
      keepPreviousData: true, // Manter dados anteriores durante atualização
      dedupingInterval: 1000, // Evitar requisições duplicadas em 1s
      onError: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('❌ Erro ao carregar produtos:', err);
        toast.error(msg.includes('401') ? 'Sessão expirada. Faça login novamente.' : 'Erro ao carregar produtos. Verifique o console (F12).');
      },
      onSuccess: (data) => {
        // Log apenas em desenvolvimento e quando necessário
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Produtos atualizados:', data?.length || 0, 'produtos');
        }
      },
    }
  );

  // SWR para pedidos (estatísticas) - só buscar se montado e com token
  const ordersKey = mounted && tenantId ? `orders-${tenantId}` : null;
  const { data: orders = [] } = useSWR<Order[]>(
    ordersKey,
    () => ordersFetcher(tenantId!), // tenantId vem do contexto JWT
    {
      refreshInterval: 10000,
      revalidateOnFocus: false, // Desabilitado para evitar erros 401 constantes
      onError: (err) => {
        // Silenciar erros 401 de pedidos (não crítico para PDV)
        if (!err.message?.includes('401') && !err.message?.includes('Unauthorized')) {
          console.error('Erro ao buscar pedidos:', err);
        }
      },
    }
  );

  // Estatísticas em tempo real
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = (orders || []).filter((o: Order) => {
      if (!o || !o.created_at) return false;
      return new Date(o.created_at).toDateString() === today;
    });

    const totalSales = todayOrders.reduce((sum: number, o: Order) => {
      const amount = o.total_amount;
      if (amount === null || amount === undefined) return sum;
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
      return sum + (isNaN(numAmount) ? 0 : numAmount);
    }, 0);
    
    const totalOrders = todayOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const lowStockCount = products.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length;

    return { totalSales, totalOrders, avgTicket, lowStockCount };
  }, [orders, products]);

  // Produtos filtrados com autocomplete - com memoização estável
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    if (!debouncedSearch) return products;
    
    const term = debouncedSearch.toLowerCase();
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.description?.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [products, debouncedSearch]);

  // Sugestões de autocomplete
  const suggestions = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) return [];
    return filteredProducts.slice(0, 5);
  }, [filteredProducts, debouncedSearch]);

  // Garantir que só execute no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug: Log quando produtos mudarem
  useEffect(() => {
    if (mounted) {
      console.log('📊 Estado dos produtos:', {
        count: products?.length || 0,
        isLoading,
        hasError: !!error,
        errorMessage: error?.message,
        isArray: Array.isArray(products),
        firstProducts: products?.slice(0, 3).map((p: any) => p.name) || [],
      });
    }
  }, [products, isLoading, error, mounted]);

  // Liberar todas as reservas ao desmontar componente (fechar página)
  useEffect(() => {
    if (!mounted || !tenantId) return;

    const releaseAllReservations = async () => {
      if (cart.length === 0) return;
      
      try {
        for (const item of cart) {
          await api.releaseStock(item.id, item.quantity, tenantId);
        }
      } catch (error) {
        console.error('Erro ao liberar reservas:', error);
      }
    };

    // Liberar ao fechar página/aba
    const handleBeforeUnload = () => {
      if (typeof window === 'undefined' || cart.length === 0) return;
      
      // Usar sendBeacon para garantir que a requisição seja enviada
      const token = localStorage.getItem('token');
      cart.forEach(item => {
        const url = `${API_BASE_URL}/products/${item.id}/release?tenantId=${tenantId}`;
        const blob = new Blob([JSON.stringify({ quantity: item.quantity })], {
          type: 'application/json',
        });
        
        // Tentar usar fetch com keepalive, senão sendBeacon
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, {
            method: 'POST',
            body: blob,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            keepalive: true,
          }).catch(() => {});
        }
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Liberar reservas ao desmontar
      if (cart.length > 0) {
        releaseAllReservations();
      }
    };
  }, [mounted, cart, tenantId]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!mounted || authLoading) return;
    
    // Se não está autenticado ou não tem tenantId, fazer login automático (desenvolvimento)
    if (!isAuthenticated || !tenantId) {
      if (process.env.NODE_ENV === 'development' && hasDevCredentials()) {
        console.log('Não autenticado, fazendo login automático...');
        autoLogin();
      } else {
        toast.error('Autenticação necessária. Faça login para continuar.');
        router.push('/login');
      }
    } else {
      console.log('Autenticado, forçando carregamento de produtos...');
      // Forçar revalidação após montar
      setTimeout(() => mutate(), 500);
    }
  }, [mounted, authLoading, isAuthenticated, tenantId, mutate, router]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Atalhos de teclado (apenas no cliente)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!mounted) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K ou Cmd+K: Focar busca
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSuggestions(true);
        return;
      }

      // F1: Mostrar ajuda
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelp(!showHelp);
        return;
      }

      // Se estiver digitando na busca, não processar outros atalhos
      if (document.activeElement === searchInputRef.current) {
        // Enter: Adicionar produto selecionado
        if (e.key === 'Enter' && !e.ctrlKey && selectedProductIndex >= 0 && suggestions[selectedProductIndex]) {
          e.preventDefault();
          handleAddToCart(suggestions[selectedProductIndex]);
          setSearchTerm('');
          setShowSuggestions(false);
          return;
        }

        // Setas: Navegar sugestões
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedProductIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedProductIndex(prev => prev > 0 ? prev - 1 : -1);
          return;
        }

        // Esc: Limpar busca
        if (e.key === 'Escape') {
          setSearchTerm('');
          setShowSuggestions(false);
          searchInputRef.current?.blur();
          return;
        }

        return;
      }

      // Ctrl+Enter: Finalizar venda
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0 && !isSelling) {
          handleSell();
        }
        return;
      }

      // Delete: Remover último item do carrinho
      if (e.key === 'Delete' && cart.length > 0 && !isSelling) {
        const lastItem = cart[cart.length - 1];
        handleRemoveFromCart(lastItem.id);
        return;
      }

      // Esc: Fechar ajuda
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, cart, isSelling, suggestions, selectedProductIndex, showHelp]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Salvar buscas recentes
  useEffect(() => {
    if (!mounted) return;
    
    if (debouncedSearch && debouncedSearch.length >= 2) {
      setRecentSearches(prev => {
        const updated = [debouncedSearch, ...prev.filter(s => s !== debouncedSearch)].slice(0, 5);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pdv_recent_searches', JSON.stringify(updated));
        }
        return updated;
      });
    }
  }, [debouncedSearch, mounted]);

  // Carregar buscas recentes
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    
    const saved = localStorage.getItem('pdv_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {}
    }
  }, [mounted]);

  const autoLogin = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    // ✅ CRÍTICO: Auto-login APENAS em desenvolvimento e se explicitamente habilitado
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowAutoLogin = process.env.NEXT_PUBLIC_ALLOW_AUTO_LOGIN === 'true';
    
    if (!isDevelopment || !allowAutoLogin) {
      // Em produção ou se não habilitado, não fazer auto-login
      setIsLoggingIn(false);
      return;
    }
    
    setIsLoggingIn(true);
    try {
      // ⚠️ CRÍTICO: Em desenvolvimento, usar credenciais apenas se configuradas via env
      if (!hasDevCredentials()) {
        toast.error('Credenciais de desenvolvimento não configuradas. Configure NEXT_PUBLIC_DEV_EMAIL, NEXT_PUBLIC_DEV_PASSWORD e NEXT_PUBLIC_DEV_TENANT_ID');
        setIsLoggingIn(false);
        return;
      }

      console.log('[DEV] Fazendo login automático...');
      const devCreds = getDevCredentials();
      const result = await login(devCreds.email, devCreds.password, devCreds.tenantId);
      
      if (result.success) {
        console.log('[DEV] Login realizado, carregando produtos...');
        // Aguardar um pouco antes de forçar revalidação
        setTimeout(() => {
          mutate();
        }, 300);
      } else {
        toast.error(result.error || 'Erro ao fazer login automático. Verifique as credenciais.');
      }
    } catch (err: any) {
      console.error('Erro no login automático:', err);
      toast.error(err.message || 'Erro ao fazer login automático. Verifique se o usuário padrão foi criado.');
    } finally {
      setIsLoggingIn(false);
    }
  }, [login, mutate]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    router.push('/login');
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleAddToCart = useCallback(async (product: Product) => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível. Faça login novamente.');
      return;
    }

    // Usar available_stock se disponível, senão usar stock
    const availableStock = (product as any).available_stock ?? product.stock ?? 0;
    
    if (availableStock === 0) {
      toast.error('Produto sem estoque disponível!');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    const quantityToAdd = existingItem ? existingItem.quantity + 1 : 1;

    // Validação crítica: verificar se tem estoque suficiente
    if (quantityToAdd > availableStock) {
      toast.error(`Estoque insuficiente! Disponível: ${availableStock} unidades.`);
      return;
    }

    try {
      // Reservar estoque no backend
      await api.reserveStock(product.id, 1, tenantId);
      
      // Adicionar ao carrinho com informação de estoque
      if (existingItem) {
        setCart(cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, stock: availableStock - 1 }
            : item
        ));
      } else {
        setCart([...cart, { 
          id: product.id, 
          name: product.name, 
          price: parseFloat(product.price), 
          quantity: 1,
          stock: availableStock - 1
        }]);
      }

      // Atualizar produtos para refletir nova reserva (sem revalidação completa)
      await mutate(undefined, { revalidate: false }); // Atualizar cache sem nova requisição

      toast.success(`${product.name} adicionado ao carrinho!`, {
        icon: '✅',
      });
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao reservar estoque';
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('autenticação')) {
        toast.error('Sessão expirada. Redirecionando para login...');
        router.push('/login');
      } else {
        toast.error(errorMsg);
      }
    }
  }, [cart, mutate, tenantId, router]);

  const handleRemoveFromCart = async (id: string) => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível.');
      return;
    }

    const item = cart.find(item => item.id === id);
    if (!item) return;

    try {
      // Liberar estoque reservado no backend
      await api.releaseStock(id, item.quantity, tenantId);
      
      // Remover do carrinho
      setCart(cart.filter(cartItem => cartItem.id !== id));
      
      // Forçar atualização imediata dos produtos para refletir liberação
      await mutate(); // Revalidar imediatamente

      toast.success(`${item.name} removido do carrinho`);
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao liberar estoque';
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('autenticação')) {
        // Se for erro de auth, apenas remover do carrinho localmente
        setCart(cart.filter(cartItem => cartItem.id !== id));
        toast.success(`${item.name} removido do carrinho`);
        router.push('/login');
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleUpdateQuantity = async (id: string, quantity: number) => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível.');
      return;
    }

    if (quantity <= 0) {
      await handleRemoveFromCart(id);
      return;
    }

    const cartItem = cart.find(item => item.id === id);
    const product = products.find(p => p.id === id);

    if (!cartItem || !product) return;

    const availableStock = (product as any).available_stock ?? product.stock ?? 0;

    // Validação crítica: não permitir quantidade > estoque disponível
    if (quantity > availableStock) {
      toast.error(`Estoque insuficiente! Disponível: ${availableStock} unidades.`);
      return;
    }

    const quantityDiff = quantity - cartItem.quantity;

    try {
      if (quantityDiff > 0) {
        // Aumentar quantidade: reservar mais estoque
        await api.reserveStock(id, quantityDiff, tenantId);
      } else if (quantityDiff < 0) {
        // Diminuir quantidade: liberar estoque
        await api.releaseStock(id, Math.abs(quantityDiff), tenantId);
      }

      // Atualizar quantidade no carrinho
      setCart(cart.map(item =>
        item.id === id ? { ...item, quantity, stock: availableStock - quantity } : item
      ));

      // Forçar atualização imediata dos produtos para refletir mudança na reserva
      await mutate(); // Revalidar imediatamente
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao atualizar estoque';
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('autenticação')) {
        toast.error('Sessão expirada. Redirecionando para login...');
        router.push('/login');
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleSell = async () => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível. Faça login novamente.');
      return;
    }

    if (cart.length === 0) {
      toast.error('Carrinho vazio!');
      return;
    }

    const invalidItems: string[] = [];
    for (const item of cart) {
      const product = products.find(p => p.id === item.id);
      if (!product) {
        invalidItems.push(item.name);
        continue;
      }
      const availableStock = (product as any).available_stock ?? product.stock ?? 0;
      if (item.quantity > availableStock) {
        invalidItems.push(`${item.name} (disponível: ${availableStock})`);
      }
    }

    if (invalidItems.length > 0) {
      toast.error(`Estoque insuficiente para: ${invalidItems.join(', ')}`);
      return;
    }

    setPaymentError(null);
    setPaymentData(null);
    setOrderData(null);
    setShowPayment(true);
  };

  const handleCreateOrderAndPayment = async () => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível. Faça login novamente.');
      return;
    }
    if (cart.length === 0) {
      toast.error('Carrinho vazio!');
      return;
    }
    if (paymentMethod === 'dinheiro') {
      const received = Number(cashReceived.replace(',', '.'));
      if (!Number.isFinite(received) || received <= 0) {
        toast.error('Informe o valor recebido.');
        return;
      }
      if (received < total) {
        toast.error('Valor recebido menor que o total.');
        return;
      }
    }

    const order = {
      channel: 'pdv',
      items: cart.map(item => ({
        produto_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      })),
      discount_amount: 0,
      shipping_amount: 0,
      coupon_code: couponCode ? couponCode.trim().toUpperCase() : undefined,
    };

    setPaymentLoading(true);
    setIsSelling(true);
    setPaymentError(null);
    try {
      const loadingToast = toast.loading('Criando pedido...');
      const createdOrder = await api.createOrder(order, tenantId);
      toast.dismiss(loadingToast);

      const createdTotal = typeof createdOrder.total_amount === 'string'
        ? parseFloat(createdOrder.total_amount)
        : Number(createdOrder.total_amount);

      setOrderData({
        id: createdOrder.id,
        total: Number.isFinite(createdTotal) ? createdTotal : total,
        orderNo: createdOrder.order_no,
      });

      const paymentResult: PaymentResult = await api.createPayment(
        {
          pedido_id: createdOrder.id,
          method: paymentMethod,
          amount: createdTotal || total,
        },
        tenantId,
      );

      setPaymentData(paymentResult);
      setCart([]);
      setSearchTerm('');
      await mutate();
      toast.success('Pedido criado. Pagamento gerado!');
    } catch (error: any) {
      const message = error.message || 'Não foi possível criar o pedido/pagamento';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPaymentLoading(false);
      setIsSelling(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!tenantId || !paymentData?.pagamento?.id) return;
    setPaymentLoading(true);
    try {
      await api.confirmPayment(paymentData.pagamento.id, tenantId);
      toast.success('Pagamento confirmado!');
      setShowPayment(false);
      setPaymentData(null);
      setOrderData(null);
      setCashReceived('');
      setCouponCode('');
      await mutate();
    } catch (error: any) {
      const message = error.message || 'Erro ao confirmar pagamento';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Highlight texto na busca
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() ? 
        <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark> : part
    );
  };

  const ProductSkeleton = () => (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg animate-pulse">
      <div className="flex-1">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
      <div className="h-8 bg-gray-200 rounded w-20"></div>
    </div>
  );

  // Evitar renderização até montar no cliente e ter tenantId
  if (!mounted || authLoading || !tenantId) {
    return (
      <div className="app-shell full-bleed flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="text-slate-200">
            {authLoading ? 'Carregando autenticação...' : !tenantId ? 'Aguardando tenant ID...' : 'Carregando PDV...'}
          </p>
          {!tenantId && !authLoading && (
            <p className="text-sm text-rose-200 mt-2">
              Tenant ID não disponível. Verifique se está autenticado.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell page-wrap-tight">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 2000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      {/* Dashboard de Estatísticas Melhorado */}
      <div className="w-full mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">💰 Vendas Hoje</p>
                <p className="text-3xl font-bold">R$ {stats.totalSales.toFixed(2)}</p>
              </div>
              <div className="text-4xl opacity-80">💵</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">📦 Pedidos</p>
                <p className="text-3xl font-bold">{stats.totalOrders}</p>
              </div>
              <div className="text-4xl opacity-80">📊</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium mb-1">🎫 Ticket Médio</p>
                <p className="text-3xl font-bold">R$ {stats.avgTicket.toFixed(2)}</p>
              </div>
              <div className="text-4xl opacity-80">📈</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium mb-1">⚠️ Estoque Baixo</p>
                <p className="text-3xl font-bold">{stats.lowStockCount}</p>
              </div>
              <div className="text-4xl opacity-80">⚠️</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-emerald-500 bg-clip-text text-transparent">
                  PDV - Loja Chocola Velha
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Sistema de Vendas • {mounted ? new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Carregando...'}
                </p>
              </div>
              {isLoading && (
                <span className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full">
                  <span className="animate-spin">🔄</span>
                  Sincronizando...
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              disabled={isSelling}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all hover:shadow-lg"
            >
              Sair
            </button>
          </div>

          {/* Modal de Ajuda */}
          {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">⌨️ Atalhos de Teclado</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold mb-2">Navegação:</p>
                    <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl+K</kbd> - Focar busca</p>
                    <p><kbd className="px-2 py-1 bg-gray-100 rounded">↑/↓</kbd> - Navegar produtos</p>
                    <p><kbd className="px-2 py-1 bg-gray-100 rounded">Enter</kbd> - Adicionar produto</p>
                    <p><kbd className="px-2 py-1 bg-gray-100 rounded">Esc</kbd> - Limpar busca</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Ações:</p>
                    <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl+Enter</kbd> - Finalizar venda</p>
                    <p><kbd className="px-2 py-1 bg-gray-100 rounded">Delete</kbd> - Remover último item</p>
                    <p><kbd className="px-2 py-1 bg-gray-100 rounded">F1</kbd> - Mostrar ajuda</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
          
          {/* Busca com Autocomplete Melhorada */}
          <div className="mb-6 relative">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="🔍 Digite o nome do produto para buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                  setSelectedProductIndex(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                disabled={isLoading || isLoggingIn}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowSuggestions(false);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Sugestões de Autocomplete */}
            {showSuggestions && suggestions.length > 0 && searchTerm.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((product, index) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      handleAddToCart(product);
                      setSearchTerm('');
                      setShowSuggestions(false);
                    }}
                    onMouseEnter={() => setSelectedProductIndex(index)}
                    className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                      index === selectedProductIndex ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="font-medium">{highlightText(product.name, searchTerm)}</p>
                    <p className="text-sm text-gray-600">R$ {parseFloat(product.price).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Buscas Recentes */}
            {showSuggestions && recentSearches.length > 0 && searchTerm.length < 2 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                <p className="px-3 py-2 text-xs text-gray-500 border-b">Buscas Recentes</p>
                {recentSearches.map((search, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSearchTerm(search);
                      setShowSuggestions(false);
                    }}
                    className="p-2 cursor-pointer hover:bg-gray-50 transition-colors text-sm"
                  >
                    {search}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">📦 Produtos Disponíveis</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => mutate()}
                    disabled={isLoading}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
                    title="Recarregar produtos"
                  >
                    {isLoading ? '🔄' : '↻'}
                  </button>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
                  </span>
                </div>
              </div>
              {isLoggingIn ? (
                <div className="space-y-2">
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                </div>
              ) : isLoading ? (
                <div className="space-y-2">
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-2">Erro ao carregar produtos</p>
                  <p className="text-xs text-gray-500 mb-4">{error.message || 'Erro desconhecido'}</p>
                  <button
                    onClick={() => mutate()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : !products || products.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Nenhum produto encontrado</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => mutate()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      🔄 Recarregar Produtos
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                      Se persistir, execute: <code className="bg-gray-100 px-2 py-1 rounded">npm.cmd run seed:mae</code> no backend
                    </p>
                  </div>
                </div>
              ) : filteredProducts.length === 0 && searchTerm ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhum produto encontrado para &quot;{searchTerm}&quot;
                </p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all hover:shadow-lg bg-white"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">R$ {parseFloat(product.price).toFixed(2)}</p>
                          {(() => {
                            const availableStock = (product as any).available_stock ?? product.stock ?? 0;
                            const totalStock = product.stock ?? 0;
                            return (
                              <span className={`text-xs px-2 py-1 rounded transition-colors ${
                                availableStock === 0
                                  ? 'bg-red-100 text-red-700'
                                  : availableStock <= (product.min_stock || 0)
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                              }`} title={`Total: ${totalStock} | Disponível: ${availableStock}`}>
                                Est: {availableStock}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={(() => {
                          const availableStock = (product as any).available_stock ?? product.stock ?? 0;
                          return availableStock === 0 || isSelling;
                        })() || isSelling}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-md"
                      >
                        {(() => {
                          const availableStock = (product as any).available_stock ?? product.stock ?? 0;
                          return availableStock === 0 ? '❌ Sem estoque' : '➕ Adicionar';
                        })()}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">🛒 Carrinho de Vendas</h2>
                {cart.length > 0 && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </div>
              {cart.length === 0 ? (
                <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-6xl mb-4">🛒</p>
                  <p className="text-lg font-medium mb-2">Carrinho vazio</p>
                  <p className="text-sm">Adicione produtos para começar uma venda</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {cart.map((item, index) => {
                    const product = products.find(p => p.id === item.id);
                    const availableStock = product?.stock || item.stock || 0;
                    const isStockLow = item.quantity > availableStock;
                    
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                          isStockLow 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-200 bg-white hover:shadow-md'
                        }`}
                        style={{
                          animation: `slideIn 0.3s ease-out ${index * 0.05}s both`,
                        }}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-gray-600">
                              R$ {item.price.toFixed(2)} x {item.quantity}
                            </p>
                            {availableStock !== undefined && (
                              <span className={`text-xs px-2 py-1 rounded transition-colors ${
                                availableStock === 0
                                  ? 'bg-red-100 text-red-700'
                                  : availableStock < item.quantity
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                Est: {availableStock}
                              </span>
                            )}
                          </div>
                          {isStockLow && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ Estoque insuficiente!
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={isSelling}
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all hover:scale-110"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= availableStock || isSelling}
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all hover:scale-110"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            disabled={isSelling}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all hover:scale-110"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 pt-6 border-t-2 border-gray-200 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total da Venda</p>
                    <p className="text-4xl font-bold text-green-600">
                      R$ {total.toFixed(2)}
                    </p>
                  </div>
                  {cart.length > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600 mb-1">Itens</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSell}
                  disabled={
                    cart.length === 0 || 
                    isSelling ||
                    cart.some(item => {
                      const product = products.find(p => p.id === item.id);
                      const availableStock = product ? ((product as any).available_stock ?? product.stock ?? 0) : 0;
                      return item.quantity > availableStock;
                    })
                  }
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-lg rounded-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-xl"
                >
                  {isSelling ? (
                    <>
                      <span className="animate-spin text-2xl">🔄</span>
                      <span>Processando venda...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">💰</span>
                      <span>FINALIZAR VENDA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Pagamento</h2>
                <p className="text-sm text-gray-500">Total: R$ {total.toFixed(2)}</p>
                {orderData?.orderNo && (
                  <p className="text-xs text-gray-400">Pedido: {orderData.orderNo}</p>
                )}
              </div>
              <button
                onClick={() => setShowPayment(false)}
                disabled={paymentLoading}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`rounded-xl border-2 px-4 py-3 text-left ${paymentMethod === 'pix' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
              >
                <p className="font-semibold">PIX</p>
                <p className="text-xs text-gray-500">QR code e copia/cola</p>
              </button>
              <button
                onClick={() => setPaymentMethod('dinheiro')}
                className={`rounded-xl border-2 px-4 py-3 text-left ${paymentMethod === 'dinheiro' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'}`}
              >
                <p className="font-semibold">Dinheiro</p>
                <p className="text-xs text-gray-500">Troco calculado</p>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500">Cupom</label>
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="EX: PROMO10"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {paymentMethod === 'dinheiro' && (
                <div>
                  <label className="text-xs text-gray-500">Valor recebido</label>
                  <input
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0,00"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  {cashReceived && (
                    <p className="text-xs text-gray-500 mt-1">
                      Troco: R$ {Math.max(0, Number(cashReceived.replace(',', '.')) - total).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {paymentError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {paymentError}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleCreateOrderAndPayment}
                disabled={paymentLoading}
                className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:bg-gray-300"
              >
                {paymentLoading ? 'Processando...' : 'Gerar pagamento'}
              </button>
              {paymentData?.pagamento?.id && (
                <button
                  onClick={handleConfirmPayment}
                  disabled={paymentLoading}
                  className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-semibold hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  Confirmar pagamento
                </button>
              )}
            </div>

            {paymentData && (
              <div className="mt-4 border-t pt-4">
                {paymentData.message && (
                  <p className="text-sm text-gray-600 whitespace-pre-line mb-3">{paymentData.message}</p>
                )}
                {paymentMethod === 'pix' && paymentData.qr_code && (
                  <div className="flex flex-col items-center gap-3">
                    <img src={paymentData.qr_code} alt="QR Code Pix" className="w-48 h-48" />
                    {paymentData.copy_paste && (
                      <div className="w-full">
                        <label className="text-xs text-gray-500">Copia e cola</label>
                        <textarea
                          readOnly
                          className="w-full border rounded-lg p-2 text-xs mt-1"
                          value={paymentData.copy_paste}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
