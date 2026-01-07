'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import useSWR from 'swr';
import api from '@/lib/api-client';

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

const TENANT_ID = '00000000-0000-0000-0000-000000000000';

// Fetchers para SWR
const productsFetcher = async (tenantId: string) => {
  return api.getProducts(tenantId);
};

const ordersFetcher = async (tenantId: string) => {
  try {
    return await api.getOrders(tenantId);
  } catch {
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSelling, setIsSelling] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // SWR para produtos
  const { data: products = [], error, isLoading, mutate } = useSWR<Product[]>(
    TENANT_ID,
    productsFetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      onError: (err) => {
        console.error('Erro ao carregar produtos:', err);
        toast.error('Erro ao carregar produtos');
      },
    }
  );

  // SWR para pedidos (estatísticas)
  const { data: orders = [] } = useSWR<Order[]>(
    TENANT_ID,
    ordersFetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  );

  // Estatísticas em tempo real
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter((o: Order) => 
      new Date(o.created_at).toDateString() === today
    );

    const totalSales = todayOrders.reduce((sum: number, o: Order) => sum + Number(o.total_amount), 0);
    const totalOrders = todayOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const lowStockCount = products.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length;

    return { totalSales, totalOrders, avgTicket, lowStockCount };
  }, [orders, products]);

  // Produtos filtrados com autocomplete
  const filteredProducts = useMemo(() => {
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      autoLogin();
    }
  }, []);

  // Atalhos de teclado
  useEffect(() => {
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
  }, [cart, isSelling, suggestions, selectedProductIndex, showHelp]);

  // Salvar buscas recentes
  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 2) {
      setRecentSearches(prev => {
        const updated = [debouncedSearch, ...prev.filter(s => s !== debouncedSearch)].slice(0, 5);
        localStorage.setItem('pdv_recent_searches', JSON.stringify(updated));
        return updated;
      });
    }
  }, [debouncedSearch]);

  // Carregar buscas recentes
  useEffect(() => {
    const saved = localStorage.getItem('pdv_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const autoLogin = async () => {
    setIsLoggingIn(true);
    try {
      const response: any = await api.login('admin@loja.com', 'senha123');
      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        await mutate();
      }
    } catch (err) {
      console.error('Erro no login automático:', err);
      toast.error('Erro ao fazer login automático. Verifique se o usuário padrão foi criado.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleAddToCart = useCallback((product: Product) => {
    if (product.stock === 0) {
      toast.error('Produto sem estoque!');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    const quantityToAdd = existingItem ? existingItem.quantity + 1 : 1;

    if (quantityToAdd > (product.stock || 0)) {
      toast.error(`Estoque insuficiente! Disponível: ${product.stock} unidades.`);
      return;
    }

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1, stock: product.stock }
          : item
      ));
    } else {
      setCart([...cart, { 
        id: product.id, 
        name: product.name, 
        price: parseFloat(product.price), 
        quantity: 1,
        stock: product.stock
      }]);
    }

    toast.success(`${product.name} adicionado ao carrinho!`, {
      icon: '✅',
    });
  }, [cart]);

  const handleRemoveFromCart = (id: string) => {
    const item = cart.find(item => item.id === id);
    setCart(cart.filter(item => item.id !== id));
    if (item) {
      toast.success(`${item.name} removido do carrinho`);
    }
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(id);
      return;
    }

    const cartItem = cart.find(item => item.id === id);
    const product = products.find(p => p.id === id);

    if (!cartItem || !product) return;

    if (quantity > (product.stock || 0)) {
      toast.error(`Estoque insuficiente! Disponível: ${product.stock} unidades.`);
      return;
    }

    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity, stock: product.stock } : item
    ));
  };

  const handleSell = async () => {
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
      if (item.quantity > (product.stock || 0)) {
        invalidItems.push(`${item.name} (disponível: ${product.stock})`);
      }
    }

    if (invalidItems.length > 0) {
      toast.error(`Estoque insuficiente para: ${invalidItems.join(', ')}`);
      return;
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
    };

    setIsSelling(true);
    try {
      const loadingToast = toast.loading('Processando venda...');
      await api.createOrder(order, TENANT_ID);
      toast.dismiss(loadingToast);
      toast.success('🎉 Venda realizada com sucesso!', {
        duration: 3000,
      });
      setCart([]);
      setSearchTerm('');
      await mutate();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível realizar a venda');
    } finally {
      setIsSelling(false);
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
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
      
      {/* Dashboard de Estatísticas */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Vendas Hoje</p>
            <p className="text-2xl font-bold text-blue-600">R$ {stats.totalSales.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Pedidos</p>
            <p className="text-2xl font-bold text-green-600">{stats.totalOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600">Ticket Médio</p>
            <p className="text-2xl font-bold text-purple-600">R$ {stats.avgTicket.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Estoque Baixo</p>
            <p className="text-2xl font-bold text-red-600">{stats.lowStockCount}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">PDV - Loja Chocola Velha</h1>
              {isLoading && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="animate-spin">🔄</span>
                  Atualizando...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title="Ajuda (F1)"
              >
                ❓ Ajuda
              </button>
              <button
                onClick={handleLogout}
                disabled={isSelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Sair
              </button>
            </div>
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
          
          {/* Busca com Autocomplete */}
          <div className="mb-4 relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar produto... (Ctrl+K para focar)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
                setSelectedProductIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              disabled={isLoading || isLoggingIn}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            
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
              <h2 className="text-lg font-semibold mb-3">Produtos Disponiveis ({filteredProducts.length})</h2>
              {isLoggingIn ? (
                <div className="space-y-2">
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                </div>
              ) : isLoading && products.length === 0 ? (
                <div className="space-y-2">
                  <ProductSkeleton />
                  <ProductSkeleton />
                  <ProductSkeleton />
                </div>
              ) : error ? (
                <p className="text-red-500">Erro ao carregar produtos</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-gray-500">Nenhum produto encontrado</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all hover:shadow-md"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">R$ {parseFloat(product.price).toFixed(2)}</p>
                          {product.stock !== undefined && (
                            <span className={`text-xs px-2 py-1 rounded transition-colors ${
                              product.stock === 0
                                ? 'bg-red-100 text-red-700'
                                : product.stock <= (product.min_stock || 0)
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              Est: {product.stock}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={(product.stock !== undefined && product.stock === 0) || isSelling}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                      >
                        {product.stock === 0 ? 'Sem estoque' : 'Adicionar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Carrinho de Vendas ({cart.length})</h2>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-2">🛒</p>
                  <p>Carrinho vazio</p>
                  <p className="text-xs mt-2">Use Ctrl+K para buscar produtos</p>
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

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-xl font-bold">
                    Total: R$ {total.toFixed(2)}
                  </p>
                  {cart.length > 0 && (
                    <p className="text-sm text-gray-500">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)} itens
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSell}
                  disabled={
                    cart.length === 0 || 
                    isSelling ||
                    cart.some(item => {
                      const product = products.find(p => p.id === item.id);
                      return item.quantity > (product?.stock || 0);
                    })
                  }
                  className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                >
                  {isSelling ? (
                    <>
                      <span className="animate-spin">🔄</span>
                      Processando...
                    </>
                  ) : (
                    <>
                      💰 VENDER (Ctrl+Enter)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
