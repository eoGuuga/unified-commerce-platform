/**
 * Testes do PdvProductSearch — busca por nome + grade com favoritos + estoque.
 *
 * O componente recebe `products` por prop (camada de dados reusada pela página),
 * o que mantém o teste sem mock de rede. localStorage real do jsdom guarda os
 * favoritos; limpamos entre os testes.
 *
 * Cobre:
 *  - digitar filtra por nome ao vivo
 *  - clicar produto com estoque chama onAdd(PdvAddableProduct)
 *  - produto esgotado (stock<=0) mostra "Esgotado" e NÃO chama onAdd (add desabilitado)
 *  - toggle de estrela reordena (favoritos primeiro)
 *  - Enter na busca adiciona o 1º resultado (com estoque) e limpa a busca
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PdvProductSearch } from './PdvProductSearch';
import type { Product } from '@/lib/types/product';

function makeProduct(over: Partial<Product> & { id: string; name: string }): Product {
  return {
    tenant_id: 't1',
    price: 10,
    unit: 'un',
    is_active: true,
    stock: 5,
    ...over,
  } as Product;
}

const products: Product[] = [
  makeProduct({ id: 'p1', name: 'Brigadeiro', price: 3.5, stock: 10 }),
  makeProduct({ id: 'p2', name: 'Beijinho', price: 3, stock: 4 }),
  makeProduct({ id: 'p3', name: 'Bolo de Pote', price: 12, stock: 0 }),
];

beforeEach(() => {
  localStorage.clear();
});

describe('PdvProductSearch', () => {
  it('renderiza os produtos ativos com nome e preço', () => {
    render(<PdvProductSearch products={products} onAdd={vi.fn()} />);
    expect(screen.getByText('Brigadeiro')).toBeInTheDocument();
    expect(screen.getByText('Beijinho')).toBeInTheDocument();
    expect(screen.getByText('Bolo de Pote')).toBeInTheDocument();
    // Preço formatado em BRL.
    expect(screen.getByText(/3,50/)).toBeInTheDocument();
  });

  it('digitar filtra por nome ao vivo', async () => {
    const user = userEvent.setup();
    render(<PdvProductSearch products={products} onAdd={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/buscar/i), 'brig');
    expect(screen.getByText('Brigadeiro')).toBeInTheDocument();
    expect(screen.queryByText('Beijinho')).not.toBeInTheDocument();
    expect(screen.queryByText('Bolo de Pote')).not.toBeInTheDocument();
  });

  it('clicar um produto com estoque chama onAdd com o PdvAddableProduct', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PdvProductSearch products={products} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: /adicionar brigadeiro/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({
      id: 'p1',
      name: 'Brigadeiro',
      price: 3.5,
      stock: 10,
    });
  });

  it('produto esgotado mostra "Esgotado" e não chama onAdd (add desabilitado)', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PdvProductSearch products={products} onAdd={onAdd} />);
    expect(screen.getByText(/esgotado/i)).toBeInTheDocument();
    const addEsgotado = screen.getByRole('button', { name: /adicionar bolo de pote/i });
    expect(addEsgotado).toBeDisabled();
    await user.click(addEsgotado);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('toggle da estrela reordena (favorito primeiro)', async () => {
    const user = userEvent.setup();
    render(<PdvProductSearch products={products} onAdd={vi.fn()} />);

    // Ordem inicial: Brigadeiro, Beijinho, Bolo de Pote.
    const before = screen.getAllByTestId('pdv-product-name').map((el) => el.textContent);
    expect(before).toEqual(['Brigadeiro', 'Beijinho', 'Bolo de Pote']);

    // Favoritar o Beijinho → deve ir para o topo.
    await user.click(screen.getByRole('button', { name: /favoritar beijinho/i }));
    const after = screen.getAllByTestId('pdv-product-name').map((el) => el.textContent);
    expect(after[0]).toBe('Beijinho');
  });

  it('Enter na busca adiciona o 1º resultado com estoque e limpa a busca', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PdvProductSearch products={products} onAdd={onAdd} />);
    const input = screen.getByPlaceholderText(/buscar/i);
    await user.type(screen.getByPlaceholderText(/buscar/i), 'be');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2', name: 'Beijinho' }),
    );
    // A busca limpa após adicionar.
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('Enter ignora produto esgotado e adiciona o 1º com estoque', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    // Lista onde o 1º resultado da busca está esgotado.
    const list: Product[] = [
      makeProduct({ id: 'e1', name: 'Doce Esgotado', stock: 0 }),
      makeProduct({ id: 'e2', name: 'Doce Disponivel', stock: 2 }),
    ];
    render(<PdvProductSearch products={list} onAdd={onAdd} />);
    const input = screen.getByPlaceholderText(/buscar/i);
    await user.type(input, 'doce');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'e2' }));
  });
});
