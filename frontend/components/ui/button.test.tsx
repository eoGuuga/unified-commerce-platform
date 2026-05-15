import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renderiza o texto filho', () => {
    render(<Button>Comprar</Button>);
    expect(
      screen.getByRole('button', { name: 'Comprar' }),
    ).toBeInTheDocument();
  });

  it('dispara onClick ao clicar', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respeita disabled e ignora cliques', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Indisponivel
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Indisponivel' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('aplica a variant destructive (classe esperada presente)', () => {
    render(<Button variant="destructive">Excluir</Button>);
    const btn = screen.getByRole('button', { name: 'Excluir' });
    // bg-destructive eh a classe-chave da variant destructive.
    expect(btn.className).toMatch(/bg-destructive/);
  });

  it('passa className adicional via cn merge', () => {
    render(<Button className="px-10">X</Button>);
    const btn = screen.getByRole('button', { name: 'X' });
    expect(btn.className).toMatch(/px-10/);
  });
});
