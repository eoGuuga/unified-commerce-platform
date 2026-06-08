'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  image?: string;
  stock?: number;
}

export interface CartState {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryType: 'delivery' | 'pickup';
  cep?: string;
  address?: string;
}

const DEFAULT_DELIVERY_FEE = 10.0;
const MIN_CART_VALUE = 30.0;

export function useCart() {
  const [cartState, setCartState] = useState<CartState>({
    items: [],
    totalItems: 0,
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
    deliveryType: 'delivery',
  });

  // Calcular totais sempre que itens mudam
  useEffect(() => {
    const subtotal = cartState.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let deliveryFee = 0;

    if (cartState.deliveryType === 'delivery' && subtotal > 0) {
      deliveryFee = subtotal >= MIN_CART_VALUE ? 0 : DEFAULT_DELIVERY_FEE;
    }

    const total = subtotal + deliveryFee;
    const totalItems = cartState.items.reduce((sum, item) => sum + item.quantity, 0);

    setCartState(prev => ({
      ...prev,
      subtotal,
      deliveryFee,
      total,
      totalItems,
    }));
  }, [cartState.items, cartState.deliveryType]);

  // Carregar carrinho do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedCart = localStorage.getItem('ucm_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        setCartState(prev => ({
          ...prev,
          items: parsed.items || [],
          deliveryType: parsed.deliveryType || 'delivery',
          cep: parsed.cep,
          address: parsed.address,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar carrinho:', error);
    }
  }, []);

  // Salvar carrinho no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('ucm_cart', JSON.stringify({
        items: cartState.items,
        deliveryType: cartState.deliveryType,
        cep: cartState.cep,
        address: cartState.address,
      }));
    } catch (error) {
      console.error('Erro ao salvar carrinho:', error);
    }
  }, [cartState.items, cartState.deliveryType, cartState.cep, cartState.address]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    setCartState(prev => {
      const existingItemIndex = prev.items.findIndex(i => i.id === item.id);

      if (existingItemIndex >= 0) {
        const updatedItems = [...prev.items];
        const newQuantity = updatedItems[existingItemIndex].quantity + quantity;

        // Verificar estoque
        if (item.stock && newQuantity > item.stock) {
          toast.error(`Quantidade indisponível. Estoque atual: ${item.stock}`);
          return prev;
        }

        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: newQuantity,
        };

        return { ...prev, items: updatedItems };
      } else {
        // Verificar estoque para novo item
        if (item.stock && quantity > item.stock) {
          toast.error(`Quantidade indisponível. Estoque atual: ${item.stock}`);
          return prev;
        }

        const newItem: CartItem = {
          ...item,
          quantity,
        };

        return { ...prev, items: [...prev.items, newItem] };
      }
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCartState(prev => {
      const item = prev.items.find(i => i.id === itemId);
      if (!item) return prev;

      // Verificar estoque
      if (item.stock && quantity > item.stock) {
        toast.error(`Quantidade indisponível. Estoque atual: ${item.stock}`);
        return prev;
      }

      const updatedItems = prev.items.map(i =>
        i.id === itemId ? { ...i, quantity } : i
      );

      return { ...prev, items: updatedItems };
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCartState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setCartState(prev => ({
      ...prev,
      items: [],
      cep: undefined,
      address: undefined,
    }));
    toast.success('Carrinho limpo');
  }, []);

  const setDeliveryType = useCallback((type: 'delivery' | 'pickup') => {
    setCartState(prev => ({ ...prev, deliveryType: type }));
  }, []);

  const setCep = useCallback((cep: string) => {
    setCartState(prev => ({ ...prev, cep }));
  }, []);

  const setAddress = useCallback((address: string) => {
    setCartState(prev => ({ ...prev, address }));
  }, []);

  const hasItems = cartState.items.length > 0;
  const isEmpty = !hasItems;
  const meetsMinimumValue = cartState.subtotal >= MIN_CART_VALUE;

  return {
    ...cartState,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    setDeliveryType,
    setCep,
    setAddress,
    hasItems,
    isEmpty,
    meetsMinimumValue,
    canCheckout: hasItems && (cartState.deliveryType === 'pickup' || meetsMinimumValue),
  };
}