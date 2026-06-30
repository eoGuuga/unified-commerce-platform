/**
 * Testes do PdvCart — painel do carrinho do PDV (componente apresentacional).
 *
 * Recebe tudo por prop (itens/total/callbacks); NÃO consome hook. A lógica de
 * mínimo/limite de quantidade é do reducer da T2 — o componente só dispara os
 * callbacks −/+, remover, limpar (com confirmação) e pagar.
 *
 * Cobre:
 *  - render de N itens (nome, subtotal unit_price×quantity, total formatado BRL)
 *  - −/+ chamam onDec/onInc com o id certo; remover chama onRemove
 *  - PAGAR desabilitado com payDisabled=true; habilitado com false
 *  - "Limpar" com itens pede confirmação (window.confirm) e só chama onClear se confirmado
 *  - estado vazio renderiza a mensagem amigável
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PdvCart } from './PdvCart';
import type { PdvCartItem } from '@/lib/pdv/cart';

function makeItem(over: Partial<PdvCartItem> & { produto_id: string; name: string }): PdvCartItem {
  return {
    unit_price: 10,
    quantity: 1,
    stock: 5,
    ...over,
  };
}

const items: PdvCartItem[] = [
  makeItem({ produto_id: 'p1', name: 'Brigadeiro', unit_price: 3.5, quantity: 2 }),
  makeItem({ produto_id: 'p2', name: 'Beijinho', unit_price: 3, quantity: 1 }),
];

const baseProps = {
  items,
  total: 10,
  onInc: vi.fn(),
  onDec: vi.fn(),
  onRemove: vi.fn(),
  onClear: vi.fn(),
  onPay: vi.fn(),
  payDisabled: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PdvCart', () => {
  it('renderiza N itens com nome e subtotal (unit_price × quantity)', () => {
    render(<PdvCart {...baseProps} />);
    expect(screen.getByText('Brigadeiro')).toBeInTheDocument();
    expect(screen.getByText('Beijinho')).toBeInTheDocument();
    const subtotals = screen
      .getAllByTestId('pdv-cart-item-subtotal')
      .map((el) => el.textContent);
    // Subtotal Brigadeiro = 3,50 × 2 = 7,00 ; Beijinho = 3,00 × 1 = 3,00
    expect(subtotals[0]).toMatch(/7,00/);
    expect(subtotals[1]).toMatch(/3,00/);
  });

  it('exibe o total formatado em BRL', () => {
    render(<PdvCart {...baseProps} total={12.5} />);
    expect(screen.getByText(/R\$\s*12,50/)).toBeInTheDocument();
  });

  it('+ chama onInc com o id do item', async () => {
    const user = userEvent.setup();
    const onInc = vi.fn();
    render(<PdvCart {...baseProps} onInc={onInc} />);
    await user.click(screen.getByRole('button', { name: /aumentar brigadeiro/i }));
    expect(onInc).toHaveBeenCalledTimes(1);
    expect(onInc).toHaveBeenCalledWith('p1');
  });

  it('− chama onDec com o id do item', async () => {
    const user = userEvent.setup();
    const onDec = vi.fn();
    render(<PdvCart {...baseProps} onDec={onDec} />);
    await user.click(screen.getByRole('button', { name: /diminuir beijinho/i }));
    expect(onDec).toHaveBeenCalledTimes(1);
    expect(onDec).toHaveBeenCalledWith('p2');
  });

  it('remover chama onRemove com o id do item', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<PdvCart {...baseProps} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: /remover brigadeiro/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('p1');
  });

  it('PAGAR habilitado dispara onPay quando payDisabled=false', async () => {
    const user = userEvent.setup();
    const onPay = vi.fn();
    render(<PdvCart {...baseProps} payDisabled={false} onPay={onPay} />);
    const pay = screen.getByRole('button', { name: /pagar/i });
    expect(pay).toBeEnabled();
    await user.click(pay);
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('PAGAR desabilitado quando payDisabled=true', () => {
    render(<PdvCart {...baseProps} payDisabled={true} />);
    expect(screen.getByRole('button', { name: /pagar/i })).toBeDisabled();
  });

  it('"Limpar" com itens pede confirmação e chama onClear quando confirmado', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PdvCart {...baseProps} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: /limpar/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('"Limpar" com itens NÃO chama onClear quando confirmação é cancelada', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<PdvCart {...baseProps} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: /limpar/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('estado vazio renderiza a mensagem amigável e não pede confirmação ao limpar', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PdvCart {...baseProps} items={[]} total={0} onClear={onClear} />);
    expect(screen.getByText(/carrinho vazio/i)).toBeInTheDocument();

    // Limpar vazio: desabilitado/no-op — não dispara confirmação nem onClear.
    const limpar = screen.getByRole('button', { name: /limpar/i });
    await user.click(limpar);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('estado vazio desabilita PAGAR mesmo se payDisabled não for passado pela página', () => {
    render(<PdvCart {...baseProps} items={[]} total={0} payDisabled={true} />);
    expect(screen.getByRole('button', { name: /pagar/i })).toBeDisabled();
  });
});
