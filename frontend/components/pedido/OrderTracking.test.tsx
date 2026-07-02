import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { OrderTracking } from './OrderTracking';
import api from '@/lib/api-client';

/** Preenche o contato e submete o formulário de rastreio. */
function submitContact(value = 'cliente@x.com') {
  fireEvent.change(
    screen.getByPlaceholderText(/e-mail ou telefone da compra/i),
    { target: { value } },
  );
  fireEvent.click(screen.getByRole('button', { name: /acompanhar pedido/i }));
}

describe('OrderTracking — B6 (distingue erro de servidor de "não encontrado")', () => {
  beforeEach(() => {
    // silencia o console.error de erros esperados no fluxo
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('B6: erro 500 mostra mensagem de problema no servidor (não "não encontrado")', async () => {
    vi.spyOn(api, 'trackPublicOrder').mockRejectedValue(
      Object.assign(new Error('Internal server error'), { status: 500 }),
    );

    render(<OrderTracking orderNo="PDV-1" />);
    submitContact();

    expect(
      await screen.findByText(/tivemos um problema ao consultar/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/não encontrado ou os dados não conferem/i),
    ).not.toBeInTheDocument();
  });

  it('B6: erro 404 mantém a mensagem de "não encontrado / confira os dados"', async () => {
    vi.spyOn(api, 'trackPublicOrder').mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 }),
    );

    render(<OrderTracking orderNo="PDV-1" />);
    submitContact();

    expect(
      await screen.findByText(/não encontrado ou os dados não conferem/i),
    ).toBeInTheDocument();
  });
});
