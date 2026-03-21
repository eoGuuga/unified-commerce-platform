'use client';

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Compass,
  Copy,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
} from 'lucide-react';
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

interface SaleSnapshot {
  items: CartItem[];
  total: number;
  itemsCount: number;
}

interface CompletedSaleState {
  orderNo?: string;
  total: number;
  paymentMethod: PaymentMethod;
  itemsCount: number;
  changeAmount?: number;
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

function LaunchCard({
  icon,
  eyebrow,
  title,
  description,
  status,
  actionLabel,
  onClick,
  complete = false,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  actionLabel: string;
  onClick: () => void;
  complete?: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-100">
          {icon}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] ${
            complete
              ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
              : 'border-white/10 bg-white/10 text-slate-200/80'
          }`}
        >
          {status}
        </span>
      </div>

      <p className="mt-5 text-xs uppercase tracking-[0.28em] text-cyan-100/65">{eyebrow}</p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>

      <button
        onClick={onClick}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
      >
        {actionLabel}
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

export default function PDVPage() {
  const router = useRouter();
  const { user, tenantId, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartItem[]>([]);
  const tenantIdRef = useRef<string | null>(null);
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
  const [saleSnapshot, setSaleSnapshot] = useState<SaleSnapshot | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedSaleState | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    tenantIdRef.current = tenantId ?? null;
  }, [tenantId]);

  const releaseCartReservations = useCallback(
    async (items: CartItem[], options?: { keepalive?: boolean }) => {
      const activeTenantId = tenantIdRef.current;
      if (!activeTenantId || items.length === 0) return;

      if (options?.keepalive && typeof window !== 'undefined') {
        const token = localStorage.getItem('token');

        await Promise.allSettled(
          items.map((item) =>
            fetch(`${API_BASE_URL}/products/${item.id}/release?tenantId=${activeTenantId}`, {
              method: 'POST',
              body: JSON.stringify({ quantity: item.quantity }),
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              keepalive: true,
            }),
          ),
        );
        return;
      }

      await Promise.allSettled(
        items.map((item) => api.releaseStock(item.id, item.quantity, activeTenantId)),
      );
    },
    [],
  );

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

  // Liberar reservas apenas ao sair da página.
  useEffect(() => {
    if (!mounted) return;

    // Liberar ao fechar página/aba
    const handleBeforeUnload = () => {
      void releaseCartReservations(cartRef.current, { keepalive: true });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void releaseCartReservations(cartRef.current);
    };
  }, [mounted, releaseCartReservations]);

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
    logout();
    router.push('/login');
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const resetPaymentFlow = () => {
    setShowPayment(false);
    setPaymentMethod('pix');
    setCashReceived('');
    setCouponCode('');
    setPaymentError(null);
    setOrderData(null);
    setPaymentData(null);
    setSaleSnapshot(null);
    setCompletedSale(null);
  };

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
    setSaleSnapshot(null);
    setCompletedSale(null);
    setShowPayment(true);
  };

  const handleCreateOrderAndPayment = async () => {
    if (!tenantId) {
      toast.error('Tenant ID não disponível. Faça login novamente.');
      return;
    }
    const hasExistingOrder = Boolean(orderData?.id);
    const checkoutTotal = orderData?.total || saleSnapshot?.total || total;

    if (!hasExistingOrder && cart.length === 0) {
      toast.error('Carrinho vazio!');
      return;
    }
    if (paymentMethod === 'dinheiro') {
      const received = Number(cashReceived.replace(',', '.'));
      if (!Number.isFinite(received) || received <= 0) {
        toast.error('Informe o valor recebido.');
        return;
      }
      if (received < checkoutTotal) {
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
      let activeOrder = orderData;
      const snapshot =
        saleSnapshot ||
        ({
          items: cart.map((item) => ({ ...item })),
          total: checkoutTotal,
          itemsCount: cart.reduce((sum, item) => sum + item.quantity, 0),
        } as SaleSnapshot);

      if (!activeOrder) {
        const loadingToast = toast.loading('Criando pedido...');
        try {
          const createdOrder = await api.createOrder(order, tenantId);
          const createdTotal =
            typeof createdOrder.total_amount === 'string'
              ? parseFloat(createdOrder.total_amount)
              : Number(createdOrder.total_amount);

          activeOrder = {
            id: createdOrder.id,
            total: Number.isFinite(createdTotal) ? createdTotal : checkoutTotal,
            orderNo: createdOrder.order_no,
          };

          setOrderData(activeOrder);
          setSaleSnapshot({
            items: snapshot.items.map((item) => ({ ...item })),
            total: activeOrder.total,
            itemsCount: snapshot.itemsCount,
          });
          setCart([]);
          setSearchTerm('');
          await mutate();
        } finally {
          toast.dismiss(loadingToast);
        }
      } else if (!saleSnapshot) {
        setSaleSnapshot({
          items: snapshot.items.map((item) => ({ ...item })),
          total: activeOrder.total,
          itemsCount: snapshot.itemsCount,
        });
      }

      setPaymentData(null);
      const paymentResult: PaymentResult = await api.createPayment(
        {
          pedido_id: activeOrder.id,
          method: paymentMethod,
          amount: activeOrder.total,
        },
        tenantId,
      );

      setPaymentData(paymentResult);
      const isDevHost =
        typeof window !== 'undefined' &&
        (['localhost', '127.0.0.1'].includes(window.location.hostname) ||
          window.location.hostname.startsWith('dev.'));

      if (paymentMethod === 'pix' && isDevHost && paymentResult?.pagamento?.id) {
        try {
          await api.confirmPayment(paymentResult.pagamento.id, tenantId);
          toast.success('Pagamento Pix simulado no DEV.');
          setShowPayment(false);
          setPaymentData(null);
          setOrderData(null);
          setCashReceived('');
          setCouponCode('');
          await mutate();
          return;
        } catch (confirmError: any) {
          const message = confirmError?.message || 'Falha ao simular pagamento Pix no DEV.';
          setPaymentError(message);
          toast.error(message);
        }
      }
      toast.success(
        hasExistingOrder
          ? 'Pagamento atualizado para o pedido em aberto!'
          : 'Pedido criado. Pagamento gerado!',
      );
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
      setPaymentData((current) =>
        current
          ? {
              ...current,
              pagamento: {
                ...current.pagamento,
                status: 'confirmed',
              },
            }
          : current,
      );
      setCompletedSale({
        orderNo: orderData?.orderNo,
        total: orderData?.total || saleSnapshot?.total || total,
        paymentMethod,
        itemsCount: saleSnapshot?.itemsCount || cartItemsCount,
        changeAmount:
          paymentMethod === 'dinheiro' && Number.isFinite(Number(cashReceived.replace(',', '.')))
            ? Math.max(0, Number(cashReceived.replace(',', '.')) - (orderData?.total || saleSnapshot?.total || total))
            : undefined,
      });
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

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const todayLabel = mounted
    ? new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }).format(new Date())
    : 'Sincronizando operacao';
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const availableProductsCount = products.filter((product) => {
    const availableStock = (product as any).available_stock ?? product.stock ?? 0;
    return availableStock > 0;
  }).length;
  const unavailableProductsCount = Math.max(0, products.length - availableProductsCount);
  const cartHasStockIssue = cart.some((item) => {
    const product = products.find((candidate) => candidate.id === item.id);
    const availableStock = product ? ((product as any).available_stock ?? product.stock ?? 0) : 0;
    return item.quantity > availableStock;
  });
  const cashChange = Math.max(0, Number(cashReceived.replace(',', '.')) - total);
  const focusSearch = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const openAdmin = () => router.push('/admin');
  const openStock = () => router.push('/admin/estoque');
  const openStore = () => router.push('/loja');
  const launchSteps = [
    {
      key: 'catalog',
      eyebrow: 'catalogo ativo',
      title: products.length > 0 ? 'O caixa ja enxerga o mix certo' : 'Publique o primeiro produto',
      description:
        products.length > 0
          ? `${products.length} produto(s) ja alimentam a busca rapida e a venda em tempo real.`
          : 'Comece pelo item mais importante do negocio e acenda a operacao com um catalogo realmente vendavel.',
      status: products.length > 0 ? 'Pronto' : 'Prioridade',
      actionLabel: products.length > 0 ? 'Refinar no admin' : 'Abrir catalogo',
      onClick: openAdmin,
      icon: <Boxes className="size-5" />,
      complete: products.length > 0,
    },
    {
      key: 'first-cart',
      eyebrow: 'primeira venda',
      title: cart.length > 0 ? 'O fechamento ja esta em movimento' : 'Monte o primeiro carrinho',
      description:
        cart.length > 0
          ? `${cartItemsCount} item(ns) ja estao separados para sentir a fluidez do caixa.`
          : 'Busque um produto, adicione ao carrinho e valide o ritual da venda sem esperar o primeiro cliente real.',
      status: cart.length > 0 ? 'Em andamento' : 'Abrir caixa',
      actionLabel: cart.length > 0 ? 'Continuar venda' : 'Buscar produto',
      onClick: focusSearch,
      icon: <ShoppingCart className="size-5" />,
      complete: cart.length > 0,
    },
    {
      key: 'confidence',
      eyebrow: 'percepcao final',
      title: stats.totalOrders > 0 ? 'O PDV ja ganhou tracao real' : 'Feche a primeira venda com confianca',
      description:
        stats.totalOrders > 0
          ? `${stats.totalOrders} pedido(s) no dia mostram que a experiencia ja saiu do papel.`
          : 'Revise estoque, atalhos e loja agora para que a primeira venda pareca inevitavel quando acontecer.',
      status: stats.totalOrders > 0 ? 'Validado' : 'Lapidar',
      actionLabel: 'Ver loja',
      onClick: openStore,
      icon: <Rocket className="size-5" />,
      complete: stats.totalOrders > 0,
    },
  ];
  const launchStepsDone = launchSteps.filter((step) => step.complete).length;
  const launchProgress = Math.round((launchStepsDone / launchSteps.length) * 100);
  const saleSummaryItems = saleSnapshot?.items || cart;
  const saleSummaryTotal = orderData?.total || saleSnapshot?.total || total;
  const copyCompletedSaleReceipt = async () => {
    if (!completedSale) return;

    const lines = [
      'GTSoftHub | comprovante da venda',
      `Pedido: ${completedSale.orderNo || 'Venda confirmada'}`,
      `Pagamento: ${completedSale.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro'}`,
      `Itens: ${completedSale.itemsCount}`,
      ...saleSummaryItems.map(
        (item) =>
          `- ${item.name} | ${item.quantity} x ${currencyFormatter.format(item.price)} = ${currencyFormatter.format(item.price * item.quantity)}`,
      ),
      '',
      `Total: ${currencyFormatter.format(completedSale.total)}`,
      ...(typeof completedSale.changeAmount === 'number'
        ? [`Troco: ${currencyFormatter.format(completedSale.changeAmount)}`]
        : []),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Comprovante da venda copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o comprovante.');
    }
  };

  // Evitar renderização até montar no cliente e ter tenantId
  if (!mounted || authLoading || !tenantId) {
    return (
      <div className="app-shell full-bleed relative isolate overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_30%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.18),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#08111f_48%,_#0f172a_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="relative mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
          <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/10 p-10 text-center text-white shadow-[0_40px_120px_rgba(8,15,30,0.55)] backdrop-blur-xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/10">
              <span className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            </div>
            <p className="text-xs uppercase tracking-[0.38em] text-cyan-100/70">
              PDV premium omnichannel
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Preparando a operação para vender com fluidez.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-200/85">
              {authLoading
                ? 'Validando autenticação e sincronizando o estoque em tempo real.'
                : !tenantId
                  ? 'Aguardando identificação do tenant para abrir o caixa com segurança.'
                  : 'Carregando o PDV e conectando os atalhos da operação.'}
            </p>
            {!tenantId && !authLoading && (
              <p className="mt-4 rounded-full border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
                Tenant ID indisponível. Faça login novamente para continuar.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell full-bleed relative isolate overflow-hidden bg-slate-950">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#0f172a',
            color: '#fff',
            border: '1px solid rgba(148, 163, 184, 0.15)',
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(16,185,129,0.16),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#071120_42%,_#0f172a_100%)]" />
      <div className="absolute left-[-9rem] top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute bottom-0 right-[-10rem] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#f8fafc] p-8 text-slate-900 shadow-[0_36px_120px_rgba(15,23,42,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Operacao rapida</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Atalhos para um caixa mais fluido</h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-slate-900">Navegacao</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p><kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Ctrl+K</kbd> focar busca</p>
                  <p><kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Setas</kbd> navegar sugestoes</p>
                  <p><kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Enter</kbd> adicionar item selecionado</p>
                  <p><kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Esc</kbd> limpar busca</p>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-slate-900">Acao</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <p><kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Ctrl+Enter</kbd> abrir o fechamento</p>
                  <p><kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Delete</kbd> remover o ultimo item</p>
                  <p><kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">F1</kbd> abrir esta ajuda</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(13,148,136,0.18)_0%,rgba(6,182,212,0.18)_32%,rgba(15,23,42,0.92)_72%,rgba(15,23,42,0.98)_100%)] p-6 text-white shadow-[0_40px_120px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.3fr,0.7fr]">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.34em] text-cyan-100/80">
                PDV premium conectado ao estoque unico
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Um balcao rapido, belo e sem atrito para fechar vendas em segundos.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200/90 sm:text-base">
                Estoque, pagamentos e operacao vivem no mesmo fluxo. Tudo aqui foi organizado para o vendedor sentir
                velocidade e o empreendedor enxergar controle em tempo real.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">Vendas hoje</p>
                  <p className="mt-3 text-3xl font-semibold">{currencyFormatter.format(stats.totalSales)}</p>
                  <p className="mt-2 text-sm text-slate-200/75">Receita sincronizada em tempo real.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">Pedidos</p>
                  <p className="mt-3 text-3xl font-semibold">{stats.totalOrders}</p>
                  <p className="mt-2 text-sm text-slate-200/75">Movimento do dia sem abrir outra tela.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">Ticket medio</p>
                  <p className="mt-3 text-3xl font-semibold">{currencyFormatter.format(stats.avgTicket)}</p>
                  <p className="mt-2 text-sm text-slate-200/75">Leitura clara da qualidade das vendas.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-6 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">Operacao atual</p>
                <h2 className="mt-3 text-2xl font-semibold">Loja Chocola Velha</h2>
                <p className="mt-2 text-sm text-slate-200/80">
                  {todayLabel} • {user?.email || 'operador autenticado'}
                </p>
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-slate-200/85">Itens no carrinho</span>
                    <strong className="text-lg font-semibold">{cartItemsCount}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-slate-200/85">Catalogo disponivel</span>
                    <strong className="text-lg font-semibold">{availableProductsCount}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-sm text-slate-200/85">Itens em atencao</span>
                    <strong className="text-lg font-semibold">{stats.lowStockCount}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => mutate()}
                    disabled={isLoading}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? 'Sincronizando estoque...' : 'Atualizar catalogo'}
                  </button>
                  <button
                    onClick={() => setShowHelp(true)}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    Atalhos
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={isSelling}
                    className="inline-flex items-center justify-center rounded-full border border-rose-200/15 bg-rose-500/15 px-5 py-3 text-sm font-medium text-rose-50 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sair
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-200/70">
                  {isLoading ? 'Sincronizacao em andamento.' : 'Caixa pronto para atender sem travas.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[30px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.22)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/70">trilha da primeira venda</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                O PDV agora conduz a operacao com mais criterio desde o primeiro clique.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Esta jornada organiza o que falta para o caixa parecer maduro, rapido e seguro logo no primeiro minuto.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-slate-950/35 px-5 py-4 text-white">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">progresso</p>
              <div className="mt-2 flex items-end gap-3">
                <p className="text-3xl font-semibold">{launchProgress}%</p>
                <p className="pb-1 text-sm text-slate-300">
                  {launchStepsDone}/{launchSteps.length} fundamentos alinhados
                </p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#34d399_100%)] transition-all"
                  style={{ width: `${Math.max(launchProgress, 8)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {launchSteps.map((step) => (
              <LaunchCard
                key={step.key}
                icon={step.icon}
                eyebrow={step.eyebrow}
                title={step.title}
                description={step.description}
                status={step.status}
                actionLabel={step.actionLabel}
                onClick={step.onClick}
                complete={step.complete}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[30px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Busca inteligente</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Encontre o produto certo sem perder o ritmo.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Digite dois caracteres ou mais para abrir sugestoes, recuperar buscas recentes e fechar a venda sem tirar a mao do teclado.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Ativos</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{availableProductsCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Em alerta</p>
                <p className="mt-2 text-2xl font-semibold text-amber-600">{stats.lowStockCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Sem estoque</p>
                <p className="mt-2 text-2xl font-semibold text-rose-600">{unavailableProductsCount}</p>
              </div>
            </div>
          </div>

          <div className="relative mt-6">
            <div className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Ctrl+K para focar a busca</p>
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setShowSuggestions(false);
                    }}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Digite nome ou descricao do produto"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                  setSelectedProductIndex(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                disabled={isLoading || isLoggingIn}
                className="w-full border-none bg-transparent px-0 py-2 text-xl font-medium text-white placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="text-sm text-slate-400">
                {isLoggingIn
                  ? 'Conectando credenciais de desenvolvimento...'
                  : searchTerm
                    ? `${filteredProducts.length} resultado(s) prontos para entrar no carrinho`
                    : 'Sugestoes inteligentes e buscas recentes aparecem aqui.'}
              </p>
            </div>

            {showSuggestions && suggestions.length > 0 && searchTerm.length >= 2 && (
              <div className="absolute z-10 mt-3 w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                {suggestions.map((product, index) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      handleAddToCart(product);
                      setSearchTerm('');
                      setShowSuggestions(false);
                    }}
                    onMouseEnter={() => setSelectedProductIndex(index)}
                    className={`cursor-pointer px-5 py-4 transition ${
                      index === selectedProductIndex ? 'bg-cyan-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{highlightText(product.name, searchTerm)}</p>
                        <p className="mt-1 text-sm text-slate-500">{currencyFormatter.format(parseFloat(product.price))}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                        {((product as any).available_stock ?? product.stock ?? 0)} un.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showSuggestions && recentSearches.length > 0 && searchTerm.length < 2 && (
              <div className="absolute z-10 mt-3 w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
                <p className="border-b border-slate-100 px-5 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">
                  Buscas recentes
                </p>
                <div className="flex flex-wrap gap-2 px-5 py-4">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchTerm(search);
                        setShowSuggestions(false);
                      }}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr,0.92fr]">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Produtos disponiveis</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => mutate()}
                    disabled={isLoading}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Recarregar produtos"
                  >
                    {isLoading ? 'Atualizando...' : 'Atualizar'}
                  </button>
                  <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
                  </span>
                </div>
              </div>
              {isLoggingIn ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                </div>
              ) : isLoading ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                </div>
              ) : error ? (
                <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-6 py-8 text-center">
                  <p className="text-lg font-semibold text-rose-700">Nao foi possivel carregar o catalogo</p>
                  <p className="mt-2 text-sm text-rose-600">{error.message || 'Erro desconhecido'}</p>
                  <button
                    onClick={() => mutate()}
                    className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : !products || products.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_46%,#f0fdf4_100%)] px-6 py-10">
                  <div className="mx-auto max-w-2xl text-center">
                    <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full border border-cyan-200 bg-white text-cyan-700 shadow-[0_18px_40px_rgba(14,165,233,0.12)]">
                      <Sparkles className="size-7" />
                    </div>
                    <p className="mt-5 text-xs uppercase tracking-[0.28em] text-slate-500">
                      caixa pronto para nascer bonito
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      Falta so acender o catalogo para a primeira venda acontecer.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Publique o produto principal no admin, revise o estoque minimo e volte para
                      sentir a venda inteira com a fluidez que o cliente vai enxergar no balcao.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <button
                        onClick={openAdmin}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Abrir catalogo
                        <ArrowRight className="size-4" />
                      </button>
                      <button
                        onClick={openStock}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Revisar estoque
                        <ShieldCheck className="size-4" />
                      </button>
                      <button
                        onClick={() => mutate()}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Atualizar PDV
                        <Compass className="size-4" />
                      </button>
                    </div>

                    <p className="mt-5 text-xs text-slate-500">
                      Se este ambiente ainda estiver vazio por seed, rode{' '}
                      <code className="rounded bg-slate-200 px-2 py-1">npm.cmd run seed:mae</code>{' '}
                      no backend.
                    </p>
                  </div>
                </div>
              ) : filteredProducts.length === 0 && searchTerm ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-lg font-semibold text-slate-900">Nenhum produto encontrado para &quot;{searchTerm}&quot;.</p>
                  <p className="mt-2 text-sm text-slate-600">Tente outro termo ou limpe a busca para ver todo o catalogo.</p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredProducts.map(product => (
                    (() => {
                      const availableStock = (product as any).available_stock ?? product.stock ?? 0;
                      const totalStock = product.stock ?? 0;
                      const stockTone =
                        availableStock === 0
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : availableStock <= (product.min_stock || 0)
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700';

                      return (
                        <div
                          key={product.id}
                          className="group rounded-[26px] border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_20px_40px_rgba(14,116,144,0.12)]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-lg font-semibold tracking-tight text-slate-950">{product.name}</p>
                              {product.description && (
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{product.description}</p>
                              )}
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${stockTone}`}>
                              {availableStock === 0
                                ? 'Sem estoque'
                                : availableStock <= (product.min_stock || 0)
                                  ? 'Reposicao'
                                  : 'Disponivel'}
                            </span>
                          </div>

                          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                              {currencyFormatter.format(parseFloat(product.price))}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">Disponivel: {availableStock}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">Total: {totalStock}</span>
                          </div>

                          <div className="mt-6 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Fluxo</p>
                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {availableStock === 0
                                  ? 'Aguardar reposicao'
                                  : availableStock <= (product.min_stock || 0)
                                    ? 'Venda com atencao'
                                    : 'Pronto para adicionar'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAddToCart(product)}
                              disabled={availableStock === 0 || isSelling}
                              className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0891b2_0%,#0f766e_100%)] px-6 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(8,145,178,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_36px_rgba(8,145,178,0.28)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                            >
                              {availableStock === 0 ? 'Sem estoque' : 'Adicionar ao carrinho'}
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Venda em tempo real</h2>
                {cart.length > 0 && (
                  <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </div>
              {cart.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#eff6ff_100%)] px-6 py-10">
                  <div className="mx-auto max-w-2xl text-center">
                    <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                      <ShoppingCart className="size-7" />
                    </div>
                    <p className="mt-5 text-xs uppercase tracking-[0.28em] text-slate-500">
                      primeira venda guiada
                    </p>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      Monte um carrinho de teste e veja o caixa ficar irresistivelmente simples.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      O fluxo ja esta pronto para reservar estoque, fechar pagamento e deixar a equipe
                      sentir a venda presencial como uma experiencia premium.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">busca</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">Ctrl+K ou clique na busca</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">estoque</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">Disponibilidade visivel antes da venda</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">fechamento</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">Pix ou dinheiro com menos atrito</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={focusSearch}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Buscar produto
                        <Search className="size-4" />
                      </button>
                      <button
                        onClick={() => setShowHelp(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Ver atalhos
                        <CheckCircle2 className="size-4" />
                      </button>
                      <button
                        onClick={openStore}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Revisar loja
                        <Store className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item, index) => {
                    const product = products.find((candidate) => candidate.id === item.id);
                    const availableStock = product ? ((product as any).available_stock ?? product.stock ?? 0) : item.stock ?? 0;
                    const isStockLow = item.quantity > availableStock;
                    
                    return (
                      <div
                        key={item.id}
                        className={`rounded-[24px] border p-4 transition ${
                          isStockLow 
                            ? 'border-rose-200 bg-rose-50' 
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]'
                        }`}
                        style={{
                          animation: `slideIn 0.3s ease-out ${index * 0.05}s both`,
                        }}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-slate-950">{item.name}</p>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  isStockLow
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {isStockLow ? 'Ajustar estoque' : 'Em ordem'}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                              <span>{currencyFormatter.format(item.price)} por unidade</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Quantidade: {item.quantity}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Disponivel: {availableStock}</span>
                            </div>
                            {isStockLow && (
                              <p className="mt-3 text-sm font-medium text-rose-700">
                                Ajuste a quantidade antes de concluir a venda.
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={isSelling}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            -
                          </button>
                          <span className="inline-flex min-w-[3rem] items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= availableStock || isSelling}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            disabled={isSelling}
                            className="inline-flex h-11 items-center justify-center rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            Remover
                          </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.88)_0%,rgba(15,23,42,0.95)_100%)] p-6 text-white shadow-[0_30px_80px_rgba(2,6,23,0.32)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/70">Fechamento</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-white">Venda pronta para concluir</p>
                    <p className="mt-2 text-sm text-slate-300">Total, itens e risco de estoque visiveis antes do pagamento.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">Total</p>
                    <p className="mt-2 text-3xl font-semibold">{currencyFormatter.format(total)}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Itens</p>
                    <p className="mt-2 text-2xl font-semibold">{cartItemsCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Alertas</p>
                    <p className="mt-2 text-2xl font-semibold">{cartHasStockIssue ? '1+' : '0'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ticket do dia</p>
                    <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(stats.avgTicket)}</p>
                  </div>
                </div>
                <button
                  onClick={handleSell}
                  disabled={cart.length === 0 || isSelling || cartHasStockIssue}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#22c55e_0%,#0f766e_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(21,128,61,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_24px_44px_rgba(21,128,61,0.32)] disabled:cursor-not-allowed disabled:bg-slate-500 disabled:shadow-none"
                >
                  {isSelling ? 'Processando venda...' : 'Abrir fechamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[30px] border border-white/10 bg-white p-6 shadow-[0_40px_120px_rgba(15,23,42,0.4)] sm:p-8">
            {completedSale ? (
              <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(16,185,129,0.18)_0%,rgba(56,189,248,0.14)_45%,rgba(15,23,42,0.98)_100%)] p-6 text-white">
                  <div className="inline-flex size-14 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                    <CheckCircle2 className="size-7" />
                  </div>
                  <p className="mt-6 text-xs uppercase tracking-[0.28em] text-emerald-100/80">
                    venda confirmada
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                    Caixa concluido com a serenidade de uma operacao madura.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-slate-200/85">
                    Pedido, total e recebimento ficaram claros do primeiro clique ate a confirmacao final.
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-300">pedido</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {completedSale.orderNo || 'Venda confirmada'}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-300">total</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {currencyFormatter.format(completedSale.total)}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-300">itens</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {completedSale.itemsCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">pos-venda</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    O operador sai com clareza e pronto para a proxima venda.
                  </h3>

                  <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-500">Metodo</span>
                        <strong className="text-sm font-semibold text-slate-950">
                          {completedSale.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro'}
                        </strong>
                      </div>
                      {typeof completedSale.changeAmount === 'number' && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-500">Troco</span>
                          <strong className="text-sm font-semibold text-slate-950">
                            {currencyFormatter.format(completedSale.changeAmount)}
                          </strong>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-500">Total confirmado</span>
                        <strong className="text-base font-semibold text-slate-950">
                          {currencyFormatter.format(completedSale.total)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ritmo</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        O fechamento terminou sem esconder risco, valor ou proximo passo.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">proxima venda</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        O caixa ja pode voltar para a busca com o mesmo fluxo premium.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">comprovante</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        O resumo da venda pode ser copiado em um clique para registro ou envio interno.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => void copyCompletedSaleReceipt()}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Copy className="size-4" />
                      Copiar comprovante
                    </button>
                    <button
                      onClick={() => {
                        resetPaymentFlow();
                        focusSearch();
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Nova venda
                      <ArrowRight className="size-4" />
                    </button>
                    <button
                      onClick={resetPaymentFlow}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Fechar resumo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Fechamento da venda</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-950">Pagamento</h2>
                    <p className="mt-2 text-sm text-slate-600">Total: {currencyFormatter.format(saleSummaryTotal)}</p>
                    {orderData?.orderNo && (
                      <p className="text-xs text-slate-400">Pedido: {orderData.orderNo}</p>
                    )}
                  </div>
                  <button
                    onClick={resetPaymentFlow}
                    disabled={paymentLoading}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-[1fr,0.9fr]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <button
                        onClick={() => setPaymentMethod('pix')}
                        className={`rounded-[24px] border-2 px-5 py-4 text-left transition ${
                          paymentMethod === 'pix'
                            ? 'border-cyan-500 bg-cyan-50 shadow-[0_12px_26px_rgba(8,145,178,0.12)]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-950">PIX</p>
                        <p className="mt-1 text-xs text-slate-500">QR code e copia e cola</p>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('dinheiro')}
                        className={`rounded-[24px] border-2 px-5 py-4 text-left transition ${
                          paymentMethod === 'dinheiro'
                            ? 'border-emerald-500 bg-emerald-50 shadow-[0_12px_26px_rgba(16,185,129,0.12)]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-950">Dinheiro</p>
                        <p className="mt-1 text-xs text-slate-500">Troco calculado automaticamente</p>
                      </button>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Parametros</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Cupom</label>
                          <input
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            disabled={Boolean(orderData?.id)}
                            placeholder="EX: PROMO10"
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                          {orderData?.id && (
                            <p className="mt-2 text-xs text-slate-500">
                              O pedido ja foi criado. Agora vamos apenas regenerar o pagamento com seguranca.
                            </p>
                          )}
                        </div>
                        {paymentMethod === 'dinheiro' && (
                          <div>
                            <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Valor recebido</label>
                            <input
                              value={cashReceived}
                              onChange={(e) => setCashReceived(e.target.value)}
                              placeholder="0,00"
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                            />
                            {cashReceived && (
                              <p className="mt-2 text-xs text-slate-500">Troco: {currencyFormatter.format(cashChange)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs leading-6 text-slate-500">
                      Ambiente de teste: o Pix funciona com comprador de teste do Mercado Pago.
                    </p>

                    {paymentError && (
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {paymentError}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={handleCreateOrderAndPayment}
                        disabled={paymentLoading}
                        className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0891b2_0%,#0f766e_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(8,145,178,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        {paymentLoading
                          ? 'Processando...'
                          : orderData?.id
                            ? 'Gerar pagamento novamente'
                            : 'Gerar pagamento'}
                      </button>
                      {paymentData?.pagamento?.id && (
                        <button
                          onClick={handleConfirmPayment}
                          disabled={paymentLoading}
                          className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#22c55e_0%,#0f766e_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(34,197,94,0.2)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        >
                          Confirmar pagamento
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white">
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">Resumo da venda</p>
                    <div className="mt-4 space-y-3">
                      {saleSummaryItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-300">{item.quantity} x {currencyFormatter.format(item.price)}</p>
                          </div>
                          <strong className="text-sm font-semibold text-white">
                            {currencyFormatter.format(item.price * item.quantity)}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
                      <span className="text-sm text-slate-300">Total final</span>
                      <strong className="text-2xl font-semibold text-white">{currencyFormatter.format(saleSummaryTotal)}</strong>
                    </div>

                    {paymentData && (
                      <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4">
                        {paymentData.message && (
                          <p className="text-sm whitespace-pre-line text-slate-300">{paymentData.message}</p>
                        )}
                        {paymentMethod === 'pix' && paymentData.qr_code && (
                          <div className="mt-4 flex flex-col items-center gap-4">
                            <Image
                              src={paymentData.qr_code}
                              alt="QR Code Pix"
                              width={192}
                              height={192}
                              unoptimized
                              className="h-48 w-48 rounded-2xl border border-white/10 bg-white p-3"
                            />
                            {paymentData.copy_paste && (
                              <div className="w-full">
                                <label className="text-xs uppercase tracking-[0.24em] text-slate-400">Copia e cola</label>
                                <textarea
                                  readOnly
                                  className="mt-2 h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200 outline-none"
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
              </>
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
