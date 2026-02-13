'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { getDevCredentials, hasDevCredentials } from '@/lib/config';
import { Toaster, toast } from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  price: string;
  description?: string;
  stock?: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// ⚠️ REMOVIDO: TENANT_ID hardcoded - deve vir do contexto JWT

export default function LojaPage() {
  const { tenantId, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevancia' | 'preco_asc' | 'preco_desc' | 'disponibilidade'>('relevancia');
  const [hydrated, setHydrated] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    deliveryType: 'delivery',
    notes: '',
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipcode: '',
    },
  });

  // ✅ CRÍTICO: Auto-login APENAS em desenvolvimento e se explicitamente habilitado
  useEffect(() => {
    const autoLogin = async () => {
      if (authLoading) return;
      if (!isAuthenticated || !tenantId) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const allowAutoLogin = process.env.NEXT_PUBLIC_ALLOW_AUTO_LOGIN === 'true';
        
        if (isDevelopment && allowAutoLogin && hasDevCredentials()) {
          try {
            const devCreds = getDevCredentials();
            await login(devCreds.email, devCreds.password, devCreds.tenantId);
          } catch (err) {
            console.error('[DEV] Erro no login automático:', err);
          }
        }
      }
    };
    autoLogin();
  }, [authLoading, isAuthenticated, tenantId, login]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api.getProducts(tenantId);
        if (cancelled) return;
        setProducts(data);
      } catch (error) {
        console.error('Erro ao carregar produtos:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCart = localStorage.getItem('loja_cart');
    const storedCustomer = localStorage.getItem('loja_customer');
    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch {
        localStorage.removeItem('loja_cart');
      }
    }
    if (storedCustomer) {
      try {
        setCustomerInfo(JSON.parse(storedCustomer));
      } catch {
        localStorage.removeItem('loja_customer');
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    localStorage.setItem('loja_cart', JSON.stringify(cart));
    localStorage.setItem('loja_customer', JSON.stringify(customerInfo));
  }, [cart, customerInfo, hydrated]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = customerInfo.deliveryType === 'delivery' ? 10 : 0;
  const total = subtotal + deliveryFee;

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return product.name.toLowerCase().includes(query) ||
      (product.description || '').toLowerCase().includes(query);
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = parseFloat(a.price);
    const priceB = parseFloat(b.price);
    if (sortBy === 'preco_asc') return priceA - priceB;
    if (sortBy === 'preco_desc') return priceB - priceA;
    if (sortBy === 'disponibilidade') {
      const stockA = a.stock ?? Number.MAX_SAFE_INTEGER;
      const stockB = b.stock ?? Number.MAX_SAFE_INTEGER;
      return stockB - stockA;
    }
    return 0;
  });

  const handleAddToCart = (product: Product) => {
    if (product.stock !== undefined && product.stock === 0) return;
    
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { 
        id: product.id, 
        name: product.name, 
        price: parseFloat(product.price), 
        quantity: 1 
      }]);
    }
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
      return;
    }

    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const handleClearCart = () => {
    setCart([]);
    setShowCart(false);
  };

  const handleCheckout = async () => {
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      toast.error('Preencha nome, email e telefone.');
      return;
    }

    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(phoneDigits)) {
      toast.error('Telefone inválido. Use DDD + número (10 ou 11 dígitos).');
      return;
    }

    if (customerInfo.deliveryType === 'delivery') {
      const { street, number, neighborhood, city, state, zipcode } = customerInfo.address;
      if (!street || !number || !neighborhood || !city || !state || !zipcode) {
        toast.error('Preencha o endereco completo para entrega.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const order = {
        channel: 'ecommerce',
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: phoneDigits,
        customer_notes: customerInfo.notes?.trim() || undefined,
        delivery_type: customerInfo.deliveryType,
        delivery_address: customerInfo.deliveryType === 'delivery'
          ? {
              street: customerInfo.address.street,
              number: customerInfo.address.number,
              complement: customerInfo.address.complement || undefined,
              neighborhood: customerInfo.address.neighborhood,
              city: customerInfo.address.city,
              state: customerInfo.address.state,
              zipcode: customerInfo.address.zipcode,
            }
          : undefined,
        items: cart.map(item => ({
          produto_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        discount_amount: 0,
        shipping_amount: deliveryFee,
      };

      if (!tenantId) {
        toast.error('Tenant ID não disponível. Faça login novamente.');
        return;
      }
      const createdOrder = await api.createOrder(order, tenantId);
      const orderNo = createdOrder?.order_no || createdOrder?.orderNo;
      toast.success(orderNo
        ? `Pedido criado! Codigo: ${orderNo}`
        : 'Pedido criado com sucesso!');
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCustomerInfo({
        name: '',
        email: '',
        phone: '',
        deliveryType: 'delivery',
        notes: '',
        address: {
          street: '',
          number: '',
          complement: '',
          neighborhood: '',
          city: '',
          state: '',
          zipcode: '',
        },
      });
    } catch (error: any) {
      toast.error(error.message || 'Nao foi possivel criar o pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <Toaster position="top-right" />
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="w-full px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Loja Chocola Velha</h1>
          <button
            onClick={() => setShowCart(true)}
            className="relative px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Carrinho
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="w-full px-6 py-6">
        <h2 className="text-3xl font-bold mb-8 text-center">Nossos Produtos</h2>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="relevancia">Ordenar: relevancia</option>
                <option value="preco_asc">Menor preco</option>
                <option value="preco_desc">Maior preco</option>
                <option value="disponibilidade">Disponibilidade</option>
              </select>
              <button
                onClick={() => { setSearchQuery(''); setSortBy('relevancia'); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Carregando produtos...</p>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProducts.map(product => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="h-48 bg-gradient-to-br from-amber-200 to-amber-600 flex items-center justify-center">
                <span className="text-6xl">{product.name.charAt(0)}</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                <p className="text-gray-600 mb-4">{product.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-green-600">
                      R$ {parseFloat(product.price).toFixed(2)}
                    </span>
                    {product.stock !== undefined && (
                      <p className={`text-xs ${product.stock > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                        Estoque: {product.stock}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock !== undefined && product.stock === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {product.stock === 0 ? 'Sem estoque' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </main>

      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Carrinho</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                X
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-gray-500">Carrinho vazio</p>
            ) : (
              <div className="space-y-4 mb-4">
                {cart.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Entrega</span>
                <span>{customerInfo.deliveryType === 'delivery' ? `R$ ${deliveryFee.toFixed(2)}` : 'Retirada'}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Finalizar Compra
              </button>
              <button
                onClick={handleClearCart}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Limpar carrinho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Checkout</h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                X
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCheckout(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Entrega
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="delivery"
                      checked={customerInfo.deliveryType === 'delivery'}
                      onChange={() => setCustomerInfo({ ...customerInfo, deliveryType: 'delivery' })}
                    />
                    Entrega
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="deliveryType"
                      value="pickup"
                      checked={customerInfo.deliveryType === 'pickup'}
                      onChange={() => setCustomerInfo({ ...customerInfo, deliveryType: 'pickup' })}
                    />
                    Retirada
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Entrega com taxa fixa de R$ {deliveryFee.toFixed(2)}.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observacoes (opcional)
                </label>
                <textarea
                  value={customerInfo.notes}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {customerInfo.deliveryType === 'delivery' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rua *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.street}
                        onChange={(e) => setCustomerInfo({
                          ...customerInfo,
                          address: { ...customerInfo.address, street: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Numero *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.number}
                        onChange={(e) => setCustomerInfo({
                          ...customerInfo,
                          address: { ...customerInfo.address, number: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.neighborhood}
                        onChange={(e) => setCustomerInfo({
                          ...customerInfo,
                          address: { ...customerInfo.address, neighborhood: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.complement}
                        onChange={(e) => setCustomerInfo({
                          ...customerInfo,
                          address: { ...customerInfo.address, complement: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cidade *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.city}
                        onChange={(e) => setCustomerInfo({
                          ...customerInfo,
                          address: { ...customerInfo.address, city: e.target.value },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estado *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.state}
                        onChange={(e) => setCustomerInfo({
                          ...customerInfo,
                          address: {
                            ...customerInfo.address,
                            state: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z]/g, '')
                              .slice(0, 2),
                          },
                        })}
                        maxLength={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CEP *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.zipcode}
                        onChange={(e) => setCustomerInfo({
                          ...customerInfo,
                          address: {
                            ...customerInfo.address,
                            zipcode: e.target.value.replace(/\D/g, '').slice(0, 8),
                          },
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entrega</span>
                    <span>{customerInfo.deliveryType === 'delivery' ? `R$ ${deliveryFee.toFixed(2)}` : 'Retirada'}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Enviando...' : 'Confirmar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
