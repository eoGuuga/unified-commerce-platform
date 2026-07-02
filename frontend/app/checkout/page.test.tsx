import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// next/link precisa do contexto de router; simplifica para <a> no teste.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import CheckoutPage from './page';

/** Renderiza e avança do passo "plano" para o passo "dados". */
function goToDados() {
  render(<CheckoutPage />);
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
}

function preencher(campo: string, valor: string) {
  fireEvent.change(screen.getByPlaceholderText(campo), { target: { value: valor } });
}

describe('CheckoutPage — C1 (valida o formato antes de avançar)', () => {
  it('bloqueia o avanço com e-mail inválido e exibe o erro', () => {
    goToDados();
    preencher('Seu nome', 'Ana');
    preencher('voce@empresa.com', 'anaempresa.com'); // sem @
    preencher('000.000.000-00', '111.444.777-35');
    preencher('(11) 99999-9999', '(11) 99999-9999');

    fireEvent.click(screen.getByRole('button', { name: /Continuar para pagamento/i }));

    expect(screen.getByText(/e-mail inválido/i)).toBeInTheDocument();
    // Não avançou para o passo de pagamento.
    expect(screen.queryByText(/Como você quer pagar/i)).not.toBeInTheDocument();
  });

  it('bloqueia CPF com letra', () => {
    goToDados();
    preencher('Seu nome', 'Ana');
    preencher('voce@empresa.com', 'ana@empresa.com');
    preencher('000.000.000-00', '111.444.777-3X'); // letra
    preencher('(11) 99999-9999', '(11) 99999-9999');

    fireEvent.click(screen.getByRole('button', { name: /Continuar para pagamento/i }));

    expect(screen.getByText(/CPF ou CNPJ inválido/i)).toBeInTheDocument();
    expect(screen.queryByText(/Como você quer pagar/i)).not.toBeInTheDocument();
  });

  it('avança quando todos os dados são válidos', () => {
    goToDados();
    preencher('Seu nome', 'Ana da Silva');
    preencher('voce@empresa.com', 'ana@empresa.com');
    preencher('000.000.000-00', '111.444.777-35');
    preencher('(11) 99999-9999', '(11) 99999-9999');

    fireEvent.click(screen.getByRole('button', { name: /Continuar para pagamento/i }));

    expect(screen.getByText(/Como você quer pagar/i)).toBeInTheDocument();
  });
});
