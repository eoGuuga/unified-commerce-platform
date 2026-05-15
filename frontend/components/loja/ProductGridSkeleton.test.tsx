import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ProductGridSkeleton } from './ProductGridSkeleton';

describe('ProductGridSkeleton', () => {
  it('renderiza 6 placeholders por default', () => {
    const { container } = render(<ProductGridSkeleton />);
    // cada item-skeleton eh um div com border-white/10 + bg-white/[0.04]
    const cards = container.querySelectorAll('.rounded-\\[32px\\]');
    expect(cards.length).toBe(6);
  });

  it('respeita o prop count customizado', () => {
    const { container } = render(<ProductGridSkeleton count={3} />);
    const cards = container.querySelectorAll('.rounded-\\[32px\\]');
    expect(cards.length).toBe(3);
  });

  it('usa animacao "pulse" nos placeholders internos', () => {
    const { container } = render(<ProductGridSkeleton count={1} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThan(0);
  });
});
