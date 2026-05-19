import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartSheet } from './CartSheet';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  cart: [] as { id: string; name: string; price: number; quantity: number }[],
  cartCount: 0,
  subtotal: 0,
  deliveryFee: 0,
  total: 0,
  deliveryType: 'delivery' as const,
  onUpdateQuantity: vi.fn(),
  onClearCart: vi.fn(),
  onCheckout: vi.fn(),
  onContinueShopping: vi.fn(),
};

describe('CartSheet', () => {
  it('mostra estado vazio quando carrinho esta vazio', () => {
    render(<CartSheet {...baseProps} />);
    expect(screen.getByText('Carrinho vazio')).toBeInTheDocument();
    expect(screen.getByText('Explorar catalogo')).toBeInTheDocument();
  });

  it('renderiza itens do carrinho com nome e preco', () => {
    const cart = [
      { id: '1', name: 'Camiseta Preta', price: 49.9, quantity: 2 },
      { id: '2', name: 'Bone Azul', price: 29.9, quantity: 1 },
    ];
    render(
      <CartSheet
        {...baseProps}
        cart={cart}
        cartCount={3}
        subtotal={129.7}
        deliveryFee={10}
        total={139.7}
      />,
    );
    expect(screen.getByText('Camiseta Preta')).toBeInTheDocument();
    expect(screen.getByText('Bone Azul')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });

  it('chama onUpdateQuantity ao clicar em remover item', async () => {
    const onUpdateQuantity = vi.fn();
    const cart = [{ id: '1', name: 'Produto A', price: 10, quantity: 1 }];
    render(
      <CartSheet
        {...baseProps}
        cart={cart}
        cartCount={1}
        onUpdateQuantity={onUpdateQuantity}
      />,
    );
    const removeBtn = screen.getByLabelText('Remover Produto A do carrinho');
    await userEvent.click(removeBtn);
    expect(onUpdateQuantity).toHaveBeenCalledWith('1', 0);
  });

  it('chama onCheckout ao clicar em Finalizar compra', async () => {
    const onCheckout = vi.fn();
    const cart = [{ id: '1', name: 'Item', price: 50, quantity: 1 }];
    render(
      <CartSheet
        {...baseProps}
        cart={cart}
        cartCount={1}
        subtotal={50}
        total={60}
        onCheckout={onCheckout}
      />,
    );
    await userEvent.click(screen.getByText('Finalizar compra'));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('chama onClearCart ao clicar em Limpar carrinho', async () => {
    const onClearCart = vi.fn();
    const cart = [{ id: '1', name: 'Item', price: 50, quantity: 1 }];
    render(
      <CartSheet
        {...baseProps}
        cart={cart}
        cartCount={1}
        onClearCart={onClearCart}
      />,
    );
    await userEvent.click(screen.getByText('Limpar carrinho'));
    expect(onClearCart).toHaveBeenCalled();
  });

  it('mostra "Sem taxa" quando deliveryType eh pickup', () => {
    const cart = [{ id: '1', name: 'Item', price: 50, quantity: 1 }];
    render(
      <CartSheet
        {...baseProps}
        cart={cart}
        cartCount={1}
        subtotal={50}
        deliveryFee={0}
        total={50}
        deliveryType="pickup"
      />,
    );
    expect(screen.getByText('Sem taxa')).toBeInTheDocument();
  });
});
