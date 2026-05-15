import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreHeader } from './StoreHeader';

describe('StoreHeader', () => {
  it('renderiza o nome da loja', () => {
    render(
      <StoreHeader
        storeName="Minha Loja"
        cartCount={0}
        onCartClick={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Minha Loja' })).toBeInTheDocument();
  });

  it('expoe o link "Acompanhar pedido"', () => {
    render(
      <StoreHeader
        storeName="X"
        cartCount={0}
        onCartClick={() => undefined}
      />,
    );
    const link = screen.getByRole('link', { name: 'Acompanhar pedido' });
    expect(link).toHaveAttribute('href', '/pedido');
  });

  it('expoe o anchor "Ver catalogo" -> #catalogo', () => {
    render(
      <StoreHeader
        storeName="X"
        cartCount={0}
        onCartClick={() => undefined}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Ver catalogo' }),
    ).toHaveAttribute('href', '#catalogo');
  });

  it('botao Carrinho dispara onCartClick', async () => {
    const onCart = vi.fn();
    render(
      <StoreHeader storeName="X" cartCount={0} onCartClick={onCart} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Carrinho/i }));
    expect(onCart).toHaveBeenCalledTimes(1);
  });

  it('exibe o cartCount quando > 0', () => {
    render(
      <StoreHeader storeName="X" cartCount={3} onCartClick={() => undefined} />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('NAO exibe contador quando cartCount=0', () => {
    render(
      <StoreHeader storeName="X" cartCount={0} onCartClick={() => undefined} />,
    );
    // o "0" nao deve aparecer como badge - so o texto "Carrinho" + icon
    const button = screen.getByRole('button', { name: /Carrinho/i });
    expect(button.textContent).not.toMatch(/\b0\b/);
  });
});
