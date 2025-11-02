'use client';

import { useState } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function PDVPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleAddToCart = (product: { id: string; name: string; price: number }) => {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(id);
      return;
    }

    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const handleSell = async () => {
    if (cart.length === 0) return;

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
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/v1/orders?tenantId=00000000-0000-0000-0000-000000000000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(order),
      });

      if (response.ok) {
        setCart([]);
        alert('Venda realizada com sucesso!');
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message || 'Nao foi possivel realizar a venda'}`);
      }
    } catch (error) {
      alert('Erro ao conectar com servidor');
    }
  };

  // Mock products para demonstracao
  const mockProducts = [
    { id: '1', name: 'Brigadeiro Gourmet', price: 10.50 },
    { id: '2', name: 'Trufa de Chocolate', price: 12.00 },
    { id: '3', name: 'Bolo de Chocolate', price: 35.00 },
  ];

  const filteredProducts = mockProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <h1 className="text-2xl font-bold mb-4">PDV - Loja Chocola Velha</h1>
          
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
              <div className="space-y-2">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-600">R$ {product.price.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Carrinho de Vendas</h2>
              {cart.length === 0 ? (
                <p className="text-gray-500">Carrinho vazio</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          R$ {item.price.toFixed(2)} x {item.quantity}
                        </p>
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
                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xl font-bold mb-4">
                  Total: R$ {total.toFixed(2)}
                </p>
                <button
                  onClick={handleSell}
                  disabled={cart.length === 0}
                  className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
