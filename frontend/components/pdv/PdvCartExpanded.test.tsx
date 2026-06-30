/**
 * Testes do PdvCartExpanded — overlay "carrinho completo" do PDV.
 *
 * Componente apresentacional: recebe tudo por prop (itens/total/callbacks),
 * usa os MESMOS callbacks do usePdvSale que o compacto. Cobre:
 *  - render de TODOS os itens (nome, preco unit, subtotal, total BRL)
 *  - −/+/remover disparam os callbacks com o id certo
 *  - PAGAR dispara onPay (e respeita payDisabled)
 *  - "Fechar" dispara onClose; estado vazio renderiza a mensagem amigavel
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PdvCartExpanded } from './PdvCartExpanded';
import type { PdvCartItem } from '@/lib/pdv/cart';

function makeItem(over: Partial<PdvCartItem> & { produto_id: string; name: string }): PdvCartItem {
  return { unit_price: 10, quantity: 1, stock: 5, ...over };
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
  onPay: vi.fn(),
  payDisabled: false,
  onClose: vi.fn(),
};

describe('PdvCartExpanded', () => {
  it('renderiza TODOS os itens com nome, subtotal e total em BRL', () => {
    render(<PdvCartExpanded {...baseProps} total={10} />);
    expect(screen.getAllByTestId('pdv-cart-expanded-item')).toHaveLength(2);
    expect(screen.getByText('Brigadeiro')).toBeInTheDocument();
    expect(screen.getByText('Beijinho')).toBeInTheDocument();
    const subtotals = screen
      .getAllByTestId('pdv-cart-expanded-item-subtotal')
      .map((el) => el.textContent);
    expect(subtotals[0]).toMatch(/7,00/); // 3,50 × 2
    expect(subtotals[1]).toMatch(/3,00/); // 3,00 × 1
    expect(screen.getByTestId('pdv-cart-expanded-total')).toHaveTextContent(/R\$\s*10,00/);
  });

  it('+/−/remover disparam os callbacks com o id certo', async () => {
    const user = userEvent.setup();
    const onInc = vi.fn();
    const onDec = vi.fn();
    const onRemove = vi.fn();
    render(<PdvCartExpanded {...baseProps} onInc={onInc} onDec={onDec} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: /aumentar brigadeiro/i }));
    expect(onInc).toHaveBeenCalledWith('p1');
    await user.click(screen.getByRole('button', { name: /diminuir beijinho/i }));
    expect(onDec).toHaveBeenCalledWith('p2');
    await user.click(screen.getByRole('button', { name: /remover brigadeiro/i }));
    expect(onRemove).toHaveBeenCalledWith('p1');
  });

  it('PAGAR dispara onPay (e respeita payDisabled)', async () => {
    const user = userEvent.setup();
    const onPay = vi.fn();
    const { rerender } = render(<PdvCartExpanded {...baseProps} onPay={onPay} />);
    const pay = screen.getByRole('button', { name: /pagar/i });
    expect(pay).toBeEnabled();
    await user.click(pay);
    expect(onPay).toHaveBeenCalledTimes(1);

    rerender(<PdvCartExpanded {...baseProps} onPay={onPay} payDisabled={true} />);
    expect(screen.getByRole('button', { name: /pagar/i })).toBeDisabled();
  });

  it('"Fechar" dispara onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PdvCartExpanded {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /fechar carrinho completo/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('estado vazio renderiza a mensagem amigavel', () => {
    render(<PdvCartExpanded {...baseProps} items={[]} total={0} />);
    const overlay = screen.getByRole('dialog', { name: /carrinho completo/i });
    expect(within(overlay).getByText(/carrinho vazio — busque um produto/i)).toBeInTheDocument();
    expect(within(overlay).queryAllByTestId('pdv-cart-expanded-item')).toHaveLength(0);
  });
});
