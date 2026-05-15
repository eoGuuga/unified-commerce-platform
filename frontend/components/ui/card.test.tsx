import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

describe('Card', () => {
  it('renderiza filhos dentro do container', () => {
    render(
      <Card>
        <span>conteudo</span>
      </Card>,
    );
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });

  it('aplica data-slot="card" para uso com seletores filhos', () => {
    const { container } = render(<Card>X</Card>);
    expect(container.querySelector('[data-slot="card"]')).not.toBeNull();
  });

  it('aceita className adicional via cn merge', () => {
    const { container } = render(<Card className="mt-8">X</Card>);
    const root = container.querySelector('[data-slot="card"]') as HTMLElement;
    expect(root.className).toMatch(/mt-8/);
    // classes default sao preservadas
    expect(root.className).toMatch(/rounded-xl/);
  });

  it('expoe slots de composicao (header, title, description, action, content, footer)', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Titulo</CardTitle>
          <CardDescription>Descricao</CardDescription>
          <CardAction>
            <button type="button">acao</button>
          </CardAction>
        </CardHeader>
        <CardContent>corpo</CardContent>
        <CardFooter>rodape</CardFooter>
      </Card>,
    );

    expect(
      container.querySelector('[data-slot="card-header"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-slot="card-title"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-slot="card-description"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-slot="card-action"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-slot="card-content"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-slot="card-footer"]'),
    ).not.toBeNull();

    expect(screen.getByText('Titulo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'acao' })).toBeInTheDocument();
  });
});
