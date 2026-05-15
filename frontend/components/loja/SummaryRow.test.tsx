import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryRow } from './SummaryRow';

describe('SummaryRow', () => {
  it('renderiza label e value', () => {
    render(<SummaryRow label="Subtotal" value="R$ 99,90" />);
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('R$ 99,90')).toBeInTheDocument();
  });

  it('default eh tom mudo (muted)', () => {
    const { container } = render(<SummaryRow label="x" value="y" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/text-muted-foreground/);
    expect(root.className).not.toMatch(/text-foreground(?!-)/);
  });

  it('strong=true muda cor e tamanho do value', () => {
    const { container } = render(
      <SummaryRow label="Total" value="R$ 110,00" strong />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/text-foreground/);
    // o span do value recebe text-lg font-semibold
    const valueEl = screen.getByText('R$ 110,00');
    expect(valueEl.className).toMatch(/font-semibold/);
    expect(valueEl.className).toMatch(/text-lg/);
  });
});
