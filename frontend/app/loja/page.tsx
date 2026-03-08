'use client';

import { useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Image from 'next/image';
import api from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { getDevCredentials, hasDevCredentials } from '@/lib/config';

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

interface CustomerAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  deliveryType: 'delivery' | 'pickup';
  notes: string;
  address: CustomerAddress;
}

type PaymentMethod = 'pix' | 'dinheiro';

interface PaymentResult {
  pagamento: {
    id: string;
    status: string;
    method: PaymentMethod;
    amount: number | string;
  };
  qr_code?: string;
  qr_code_url?: string;
  copy_paste?: string;
  message?: string;
}

interface CreatedOrder {
  id: string;
  total: number;
  orderNo?: string;
}

const DELIVERY_FEE = 10;

const initialCustomerInfo: CustomerInfo = {
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
};

export default function LojaPage() {
  const { tenantId, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevancia' | 'preco_asc' | 'preco_desc' | 'disponibilidade'>('relevancia');
  const [hydrated, setHydrated] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(initialCustomerInfo);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [couponCode, setCouponCode] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentResult | null>(null);

  useEffect(() => {
    const autoLogin = async () => {
      if (authLoading) return;
      if (isAuthenticated && tenantId) return;

      const isDevelopment = process.env.NODE_ENV === 'development';
      const allowAutoLogin = process.env.NEXT_PUBLIC_ALLOW_AUTO_LOGIN === 'true';

      if (!isDevelopment || !allowAutoLogin || !hasDevCredentials()) return;

      try {
        const devCreds = getDevCredentials();
        await login(devCreds.email, devCreds.password, devCreds.tenantId);
      } catch (err) {
        console.error('[DEV] auto-login error:', err);
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
        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error loading products:', error);
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

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const getAvailableStock = (productId: string): number | undefined => {
    const product = productById.get(productId);
    return product?.stock;
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = customerInfo.deliveryType === 'delivery' ? DELIVERY_FEE : 0;
  const checkoutTotal = subtotal + deliveryFee;
  const payableTotal = createdOrder?.total ?? checkoutTotal;

  const cashReceivedNumber = Number(cashReceived.replace(',', '.'));
  const cashChange =
    Number.isFinite(cashReceivedNumber) && cashReceivedNumber > 0
      ? Math.max(0, cashReceivedNumber - payableTotal)
      : 0;

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return (
      product.name.toLowerCase().includes(query) ||
      (product.description || '').toLowerCase().includes(query)
    );
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

  const resetPaymentState = () => {
    setPaymentMethod('pix');
    setCouponCode('');
    setCashReceived('');
    setPaymentError(null);
    setCreatedOrder(null);
    setPaymentData(null);
  };

  const handleAddToCart = (product: Product) => {
    const availableStock = product.stock;
    if (availableStock !== undefined && availableStock <= 0) {
      toast.error('Produto sem estoque.');
      return;
    }

    const existing = cart.find((item) => item.id === product.id);
    const nextQuantity = existing ? existing.quantity + 1 : 1;

    if (availableStock !== undefined && nextQuantity > availableStock) {
      toast.error(`Estoque insuficiente. Disponivel: ${availableStock}`);
      return;
    }

    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQuantity } : item,
        ),
      );
      return;
    }

    setCart([
      ...cart,
      {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
      },
    ]);
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter((item) => item.id !== id));
      return;
    }

    const availableStock = getAvailableStock(id);
    if (availableStock !== undefined && quantity > availableStock) {
      toast.error(`Estoque insuficiente. Disponivel: ${availableStock}`);
      return;
    }

    setCart(cart.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const handleClearCart = () => {
    setCart([]);
    setShowCart(false);
    setShowCheckout(false);
  };

  const validateCustomerData = (): boolean => {
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      toast.error('Preencha nome, email e telefone.');
      return false;
    }

    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(phoneDigits)) {
      toast.error('Telefone invalido. Use DDD + numero (10 ou 11 digitos).');
      return false;
    }

    if (customerInfo.deliveryType === 'delivery') {
      const { street, number, neighborhood, city, state, zipcode } = customerInfo.address;
      if (!street || !number || !neighborhood || !city || !state || !zipcode) {
        toast.error('Preencha o endereco completo para entrega.');
        return false;
      }
    }

    return true;
  };

  const validateCartStock = (): boolean => {
    const invalidItems: string[] = [];

    cart.forEach((item) => {
      const availableStock = getAvailableStock(item.id);
      if (availableStock !== undefined && item.quantity > availableStock) {
        invalidItems.push(`${item.name} (disp: ${availableStock})`);
      }
    });

    if (invalidItems.length > 0) {
      toast.error(`Estoque insuficiente para: ${invalidItems.join(', ')}`);
      return false;
    }

    return true;
  };

  const handleCopyPixCode = async () => {
    if (!paymentData?.copy_paste) return;

    try {
      await navigator.clipboard.writeText(paymentData.copy_paste);
      toast.success('Codigo Pix copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o codigo Pix.');
    }
  };

  const handleCreateOrderAndPayment = async () => {
    if (!tenantId) {
      toast.error('Tenant ID nao disponivel. Faca login novamente.');
      return;
    }

    if (cart.length === 0) {
      toast.error('Carrinho vazio.');
      return;
    }

    if (!validateCustomerData() || !validateCartStock()) {
      return;
    }

    if (paymentMethod === 'dinheiro') {
      if (!Number.isFinite(cashReceivedNumber) || cashReceivedNumber <= 0) {
        toast.error('Informe o valor recebido em dinheiro.');
        return;
      }
      if (cashReceivedNumber < payableTotal) {
        toast.error('Valor recebido menor que o total.');
        return;
      }
    }

    setPaymentLoading(true);
    setPaymentError(null);

    try {
      const phoneDigits = customerInfo.phone.replace(/\D/g, '');
      const orderPayload = {
        channel: 'ecommerce',
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: phoneDigits,
        customer_notes: customerInfo.notes?.trim() || undefined,
        delivery_type: customerInfo.deliveryType,
        delivery_address:
          customerInfo.deliveryType === 'delivery'
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
        items: cart.map((item) => ({
          produto_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        discount_amount: 0,
        shipping_amount: deliveryFee,
        coupon_code: couponCode ? couponCode.trim().toUpperCase() : undefined,
      };

      const created = await api.createOrder(orderPayload, tenantId);
      const totalAmount = Number(created.total_amount);
      const orderTotal = Number.isFinite(totalAmount) ? totalAmount : checkoutTotal;

      setCreatedOrder({
        id: created.id,
        total: orderTotal,
        orderNo: created.order_no || created.orderNo,
      });

      const paymentPayload: {
        pedido_id: string;
        method: PaymentMethod;
        amount: number;
        metadata?: Record<string, unknown>;
      } = {
        pedido_id: created.id,
        method: paymentMethod,
        amount: orderTotal,
      };

      if (paymentMethod === 'dinheiro' && Number.isFinite(cashReceivedNumber)) {
        paymentPayload.metadata = {
          cash_change_for: cashReceivedNumber,
          cash_change_amount: Math.max(0, cashReceivedNumber - orderTotal),
        };
      }

      const paymentResult = await api.createPayment(paymentPayload, tenantId);
      setPaymentData(paymentResult);
      setCart([]);
      setShowCart(false);
      toast.success('Pedido criado e pagamento gerado.');
    } catch (error: any) {
      const message = error?.message || 'Nao foi possivel criar pedido/pagamento';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!tenantId || !paymentData?.pagamento?.id) return;

    setPaymentLoading(true);
    setPaymentError(null);
    try {
      await api.confirmPayment(paymentData.pagamento.id, tenantId);
      toast.success('Pagamento confirmado.');
      setShowCheckout(false);
      resetPaymentState();
      setCustomerInfo(initialCustomerInfo);
    } catch (error: any) {
      const message = error?.message || 'Erro ao confirmar pagamento';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    resetPaymentState();
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    if (paymentLoading) return;
    setShowCheckout(false);
    resetPaymentState();
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
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="relevancia">Ordenar: relevancia</option>
                <option value="preco_asc">Menor preco</option>
                <option value="preco_desc">Maior preco</option>
                <option value="disponibilidade">Disponibilidade</option>
              </select>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSortBy('relevancia');
                }}
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
            {sortedProducts.map((product) => (
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
                      disabled={product.stock !== undefined && product.stock <= 0}
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
              <button onClick={() => setShowCart(false)} className="text-gray-500 hover:text-gray-700">
                X
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-gray-500">Carrinho vazio</p>
            ) : (
              <div className="space-y-4 mb-4">
                {cart.map((item) => (
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
                <span>
                  {customerInfo.deliveryType === 'delivery'
                    ? `R$ ${deliveryFee.toFixed(2)}`
                    : 'Retirada'}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>R$ {checkoutTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={openCheckout}
                disabled={cart.length === 0}
                className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Finalizar compra
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

      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Checkout</h2>
              <button
                onClick={closeCheckout}
                disabled={paymentLoading}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                X
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateOrderAndPayment();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome completo *</label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(event) =>
                      setCustomerInfo({ ...customerInfo, name: event.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(event) =>
                      setCustomerInfo({ ...customerInfo, email: event.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(event) =>
                      setCustomerInfo({ ...customerInfo, phone: event.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de entrega</label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="deliveryType"
                        value="delivery"
                        checked={customerInfo.deliveryType === 'delivery'}
                        onChange={() =>
                          setCustomerInfo({ ...customerInfo, deliveryType: 'delivery' })
                        }
                      />
                      Entrega
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="deliveryType"
                        value="pickup"
                        checked={customerInfo.deliveryType === 'pickup'}
                        onChange={() =>
                          setCustomerInfo({ ...customerInfo, deliveryType: 'pickup' })
                        }
                      />
                      Retirada
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observacoes (opcional)
                </label>
                <textarea
                  value={customerInfo.notes}
                  onChange={(event) =>
                    setCustomerInfo({ ...customerInfo, notes: event.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {customerInfo.deliveryType === 'delivery' && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold">Endereco de entrega</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rua *</label>
                      <input
                        type="text"
                        value={customerInfo.address.street}
                        onChange={(event) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: { ...customerInfo.address, street: event.target.value },
                          })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Numero *</label>
                      <input
                        type="text"
                        value={customerInfo.address.number}
                        onChange={(event) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: { ...customerInfo.address, number: event.target.value },
                          })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bairro *</label>
                      <input
                        type="text"
                        value={customerInfo.address.neighborhood}
                        onChange={(event) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: {
                              ...customerInfo.address,
                              neighborhood: event.target.value,
                            },
                          })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address.complement}
                        onChange={(event) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: { ...customerInfo.address, complement: event.target.value },
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cidade *</label>
                      <input
                        type="text"
                        value={customerInfo.address.city}
                        onChange={(event) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: { ...customerInfo.address, city: event.target.value },
                          })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estado *</label>
                      <input
                        type="text"
                        value={customerInfo.address.state}
                        onChange={(event) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: {
                              ...customerInfo.address,
                              state: event.target.value
                                .toUpperCase()
                                .replace(/[^A-Z]/g, '')
                                .slice(0, 2),
                            },
                          })
                        }
                        required
                        maxLength={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CEP *</label>
                      <input
                        type="text"
                        value={customerInfo.address.zipcode}
                        onChange={(event) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: {
                              ...customerInfo.address,
                              zipcode: event.target.value.replace(/\D/g, '').slice(0, 8),
                            },
                          })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold">Pagamento</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`rounded-lg border px-4 py-3 text-left ${
                      paymentMethod === 'pix'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <p className="font-medium">PIX</p>
                    <p className="text-xs text-gray-500">QRCode e copia/cola</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('dinheiro')}
                    className={`rounded-lg border px-4 py-3 text-left ${
                      paymentMethod === 'dinheiro'
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <p className="font-medium">Dinheiro</p>
                    <p className="text-xs text-gray-500">Com troco</p>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cupom</label>
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                      placeholder="Ex: PROMO10"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  {paymentMethod === 'dinheiro' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor recebido
                      </label>
                      <input
                        type="text"
                        value={cashReceived}
                        onChange={(event) => setCashReceived(event.target.value)}
                        placeholder="0,00"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">Troco: R$ {cashChange.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entrega</span>
                    <span>
                      {customerInfo.deliveryType === 'delivery'
                        ? `R$ ${deliveryFee.toFixed(2)}`
                        : 'Retirada'}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>R$ {payableTotal.toFixed(2)}</span>
                  </div>
                  {createdOrder?.orderNo && (
                    <p className="text-xs text-gray-500">Pedido: {createdOrder.orderNo}</p>
                  )}
                </div>

                {paymentError && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {paymentError}
                  </div>
                )}

                {!paymentData ? (
                  <button
                    type="submit"
                    disabled={paymentLoading}
                    className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {paymentLoading ? 'Processando...' : 'Criar pedido e gerar pagamento'}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3 bg-gray-50">
                      <p className="text-sm text-gray-700">
                        Status: <strong>{paymentData.pagamento.status}</strong>
                      </p>
                      {paymentData.message && (
                        <p className="text-sm text-gray-600 whitespace-pre-line mt-2">
                          {paymentData.message}
                        </p>
                      )}
                    </div>

                    {paymentMethod === 'pix' && paymentData.qr_code && (
                      <div className="border rounded-lg p-3">
                        <div className="flex justify-center">
                          <Image
                            src={paymentData.qr_code}
                            alt="QRCode Pix"
                            width={192}
                            height={192}
                            unoptimized
                            className="w-48 h-48 object-contain"
                          />
                        </div>
                        {paymentData.copy_paste && (
                          <div className="mt-3">
                            <label className="block text-xs text-gray-500 mb-1">Copia e cola</label>
                            <textarea
                              readOnly
                              value={paymentData.copy_paste}
                              className="w-full border rounded-lg p-2 text-xs"
                              rows={3}
                            />
                            <button
                              type="button"
                              onClick={handleCopyPixCode}
                              className="mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              Copiar codigo Pix
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      disabled={paymentLoading}
                      className="w-full px-4 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {paymentLoading ? 'Confirmando...' : 'Confirmar pagamento'}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
