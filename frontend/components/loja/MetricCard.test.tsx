import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renderiza label, value e hint', () => {
    render(
      <MetricCard
        icon={<span data-testid="icon" />}
        label="vendas"
        value="R$ 1.234"
        hint="ultimas 24h"
      />,
    );
    expect(screen.getByText('vendas')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.234')).toBeInTheDocument();
    expect(screen.getByText('ultimas 24h')).toBeInTheDocument();
  });

  it('renderiza o icon recebido como ReactNode', () => {
    render(
      <MetricCard
        icon={<span data-testid="icon" />}
        label="x"
        value="y"
        hint="z"
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('aplica estilo de card', () => {
    const { container } = render(
      <MetricCard
        icon={<span />}
        label="x"
        value="y"
        hint="z"
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/rounded-/);
    expect(root.className).toMatch(/backdrop-blur/);
  });
});
