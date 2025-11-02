'use client';

import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function LojaPage() {
  const [products] = useState<Product[]>([
    { id: '1', name: 'Brigadeiro Gourmet', price: 10.50, description: 'Brigadeiro feito com chocolate premium' },
    { id: '2', name: 'Trufa de Chocolate', price: 12.00, description: 'Trufa artesanal com recheio cremoso' },
    { id: '3', name: 'Bolo de Chocolate', price: 35.00, description: 'Bolo caseiro de chocolate' },
  ]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleAddToCart = (product: Product) => {
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

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
      return;
    }

    setCart(cart.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
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

      <main className="max-w-7xl mx-auto p-4">
        <h2 className="text-3xl font-bold mb-8 text-center">Nossos Produtos</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
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
                  <span className="text-2xl font-bold text-green-600">
                    R$ {product.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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

            <div className="border-t pt-4">
              <p className="text-xl font-bold mb-4">Total: R$ {total.toFixed(2)}</p>
              <button
                onClick={() => alert('Checkout em breve!')}
                disabled={cart.length === 0}
                className="w-full px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Finalizar Compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
