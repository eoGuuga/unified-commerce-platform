'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import api from '@/lib/api-client';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock?: number; // Estoque disponível do produto
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

const TENANT_ID = '00000000-0000-0000-0000-000000000000';

export default function PDVPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Login automático se não houver token
    const token = localStorage.getItem('token');
    if (!token) {
      autoLogin();
    } else {
      loadProducts();
    }
  }, []);

  const autoLogin = async () => {
    try {
      const response: any = await api.login('admin@loja.com', 'senha123');
      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        await loadProducts();
      }
    } catch (err) {
      console.error('Erro no login automático:', err);
      setError('Erro ao fazer login automático. Verifique se o usuário padrão foi criado.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const loadProducts = async () => {
    try {
      const data = await api.getProducts(TENANT_ID);
      setProducts(data);
      setLoading(false);
    } catch (err) {
      setError('Erro ao carregar produtos');
      setLoading(false);
      toast.error('Erro ao carregar produtos');
      console.error(err);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleAddToCart = (product: Product) => {
    // Validação crítica: verificar estoque ANTES de adicionar
    if (product.stock === 0) {
      toast.error('Produto sem estoque!');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    const quantityToAdd = existingItem ? existingItem.quantity + 1 : 1;

    // Validação crítica: verificar se tem estoque suficiente
    if (quantityToAdd > (product.stock || 0)) {
      toast.error(`Estoque insuficiente! Disponível: ${product.stock} unidades.`);
      return;
    }

    // Adicionar ao carrinho com informação de estoque
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

    toast.success(`${product.name} adicionado ao carrinho!`);
  };

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

    // Validação crítica: buscar produto para verificar estoque
    const cartItem = cart.find(item => item.id === id);
    const product = products.find(p => p.id === id);

    if (!cartItem || !product) return;

    // Validação crítica: não permitir quantidade > estoque disponível
    if (quantity > (product.stock || 0)) {
      toast.error(`Estoque insuficiente! Disponível: ${product.stock} unidades.`);
      return;
    }

    // Atualizar quantidade
    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity, stock: product.stock } : item
    ));
  };

  const handleSell = async () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio!');
      return;
    }

    // Validação crítica: verificar TODOS os itens antes de vender
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

    try {
      const loadingToast = toast.loading('Processando venda...');
      await api.createOrder(order, TENANT_ID);
      toast.dismiss(loadingToast);
      toast.success('Venda realizada com sucesso!');
      setCart([]);
      await loadProducts(); // Recarregar produtos para atualizar estoque
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível realizar a venda');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">PDV - Loja Chocola Velha</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Sair
            </button>
          </div>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-3">Produtos Disponiveis</h2>
              {loading ? (
                <p className="text-gray-500">Carregando produtos...</p>
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-gray-500">Nenhum produto encontrado</p>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">R$ {parseFloat(product.price).toFixed(2)}</p>
                          {product.stock !== undefined && (
                            <span className={`text-xs px-2 py-1 rounded ${
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
                        disabled={product.stock !== undefined && product.stock === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {product.stock === 0 ? 'Sem estoque' : 'Adicionar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Carrinho de Vendas</h2>
              {cart.length === 0 ? (
                <p className="text-gray-500">Carrinho vazio</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => {
                    const product = products.find(p => p.id === item.id);
                    const availableStock = product?.stock || item.stock || 0;
                    const isStockLow = item.quantity > availableStock;
                    
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          isStockLow 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-gray-600">
                              R$ {item.price.toFixed(2)} x {item.quantity}
                            </p>
                            {availableStock !== undefined && (
                              <span className={`text-xs px-2 py-1 rounded ${
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
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= availableStock}
                            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                          >
                            +
                          </button>
                          <button
                            onClick={() => {
                              handleRemoveFromCart(item.id);
                              toast.success(`${item.name} removido do carrinho`);
                            }}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
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
                <p className="text-xl font-bold mb-4">
                  Total: R$ {total.toFixed(2)}
                </p>
                <button
                  onClick={handleSell}
                  disabled={cart.length === 0 || cart.some(item => {
                    const product = products.find(p => p.id === item.id);
                    return item.quantity > (product?.stock || 0);
                  })}
                  className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  VENDER
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
