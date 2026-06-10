'use client';

import { useState, useEffect } from 'react';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image?: string;
  image_url?: string;
  category: string;
  stock: number;
  rating?: number;
}

// Produtos placeholder realistas para demonstrar a loja
const PRODUTOS_DEMO: Product[] = [
  {
    id: '1',
    name: 'Caneca de Cerâmica Personalizada',
    description: 'Caneca de cerâmica 325ml com estampa personalizada. Perfeita para presente ou uso diário.',
    price: 29.90,
    original_price: 39.90,
    image_url: '',
    category: 'Canecas',
    stock: 47,
    rating: 4.8,
  },
  {
    id: '2',
    name: 'Camiseta Algodão Premium',
    description: 'Camiseta 100% algodão, fio 30.1, modelagem regular. Conforto para o dia a dia.',
    price: 79.90,
    image_url: '',
    category: 'Vestuário',
    stock: 23,
    rating: 4.6,
  },
  {
    id: '3',
    name: 'Caderno Sketchbook A4',
    description: 'Caderno sketchbook 80 folhas, papel off-white 120g, encadernação costurada.',
    price: 42.00,
    image_url: '',
    category: 'Papelaria',
    stock: 12,
    rating: 4.9,
  },
  {
    id: '4',
    name: 'Caneca Térmica Inox 500ml',
    description: 'Caneca térmica em aço inox, mantém temperatura por 12h. Tampa hermética.',
    price: 89.90,
    original_price: 109.90,
    image_url: '',
    category: 'Canecas',
    stock: 8,
    rating: 4.7,
  },
  {
    id: '5',
    name: 'Mochila Urbana Antifurto',
    description: 'Mochila com zíper escondido, compartimento para notebook 15", tecido impermeável.',
    price: 249.00,
    image_url: '',
    category: 'Acessórios',
    stock: 5,
    rating: 4.8,
  },
  {
    id: '6',
    name: 'Fone Bluetooth Cancelamento Ruído',
    description: 'Fone over-ear com ANC ativo, bateria 30h, conexão multipoint.',
    price: 599.00,
    original_price: 799.00,
    image_url: '',
    category: 'Eletrônicos',
    stock: 3,
    rating: 4.5,
  },
  {
    id: '7',
    name: 'Vela Aromática Lavanda',
    description: 'Vela artesanal de cera de soja, aroma lavanda francesa, 200g, queima 40h.',
    price: 54.90,
    image_url: '',
    category: 'Casa',
    stock: 18,
    rating: 4.9,
  },
  {
    id: '8',
    name: 'Agenda Permanente Premium',
    description: 'Agenda permanente couro sintético, 12 meses, elástico, bolso para caneta.',
    price: 89.00,
    image_url: '',
    category: 'Papelaria',
    stock: 22,
    rating: 4.7,
  },
];

/**
 * Hook para buscar produtos.
 * Por enquanto retorna produtos demo realistas.
 * Quando integrado com backend, substituirá por chamada real.
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simula carregamento
    const timer = setTimeout(() => {
      setProducts(PRODUTOS_DEMO);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return { products, loading, error, refetch: () => setProducts(PRODUTOS_DEMO) };
}
