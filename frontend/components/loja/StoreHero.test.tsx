import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreHero } from './StoreHero';

describe('StoreHero', () => {
  it('renderiza titulo e tagline recebida', () => {
    render(
      <StoreHero tagline="Tagline customizada da loja" onOpenCart={() => undefined} />,
    );
    expect(
      screen.getByRole('heading', { name: /Venda com uma vitrine/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tagline customizada da loja'),
    ).toBeInTheDocument();
  });

  it('badge "experiencia de compra premium"', () => {
    render(<StoreHero tagline="x" onOpenCart={() => undefined} />);
    expect(
      screen.getByText(/experiencia de compra premium/i),
    ).toBeInTheDocument();
  });

  it('mostra as 3 micro-cards (checkout/estoque/percepcao)', () => {
    render(<StoreHero tagline="x" onOpenCart={() => undefined} />);
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByText('estoque')).toBeInTheDocument();
    expect(screen.getByText('percepcao')).toBeInTheDocument();
  });

  it('CTA "Explorar catalogo" linka pra #catalogo', () => {
    render(<StoreHero tagline="x" onOpenCart={() => undefined} />);
    expect(
      screen.getByRole('link', { name: /Explorar catalogo/i }),
    ).toHaveAttribute('href', '#catalogo');
  });

  it('CTA "Abrir carrinho" dispara onOpenCart', async () => {
    const onOpen = vi.fn();
    render(<StoreHero tagline="x" onOpenCart={onOpen} />);
    await userEvent.click(
      screen.getByRole('button', { name: /Abrir carrinho/i }),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
