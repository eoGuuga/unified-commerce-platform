import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LojaConfidenceCard } from './LojaConfidenceCard';

describe('LojaConfidenceCard', () => {
  it('mostra titulo principal e overline', () => {
    render(<LojaConfidenceCard />);
    expect(
      screen.getByRole('heading', { name: /Compra segura/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sensacao para o cliente/i)).toBeInTheDocument();
  });

  it('lista os 3 sinais de confianca', () => {
    render(<LojaConfidenceCard />);
    expect(
      screen.getByText(/leitura de estoque real/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cara de operacao madura/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Entrega ou retirada sem confusao/i),
    ).toBeInTheDocument();
  });
});
