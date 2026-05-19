import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutSuccessPanel } from './CheckoutSuccessPanel';

const baseData = {
  orderNo: 'PED-001',
  total: 159.9,
  paymentMethod: 'pix' as const,
  customerName: 'Maria Silva',
  deliveryType: 'delivery' as const,
};

const baseProps = {
  data: baseData,
  onTrackOrder: vi.fn(),
  onCopyReceipt: vi.fn(),
  onContinueShopping: vi.fn(),
  onClose: vi.fn(),
};

describe('CheckoutSuccessPanel', () => {
  it('exibe nome do cliente personalizado no titulo', () => {
    render(<CheckoutSuccessPanel {...baseProps} />);
    expect(
      screen.getByText(/Maria, seu pedido agora esta oficialmente a caminho/),
    ).toBeInTheDocument();
  });

  it('exibe titulo generico quando customerName esta vazio', () => {
    render(
      <CheckoutSuccessPanel
        {...baseProps}
        data={{ ...baseData, customerName: '' }}
      />,
    );
    expect(
      screen.getByText('Seu pedido agora esta oficialmente a caminho.'),
    ).toBeInTheDocument();
  });

  it('mostra orderNo, total e recebimento nos cards', () => {
    render(<CheckoutSuccessPanel {...baseProps} />);
    expect(screen.getByText('PED-001')).toBeInTheDocument();
    expect(screen.getAllByText('Entrega').length).toBeGreaterThanOrEqual(1);
  });

  it('mostra troco previsto quando changeAmount esta presente', () => {
    render(
      <CheckoutSuccessPanel
        {...baseProps}
        data={{ ...baseData, paymentMethod: 'dinheiro', changeAmount: 40.1 }}
      />,
    );
    expect(screen.getByText('Troco previsto')).toBeInTheDocument();
  });

  it('chama onTrackOrder ao clicar em Acompanhar pedido', async () => {
    const onTrackOrder = vi.fn();
    render(<CheckoutSuccessPanel {...baseProps} onTrackOrder={onTrackOrder} />);
    await userEvent.click(screen.getByText('Acompanhar pedido agora'));
    expect(onTrackOrder).toHaveBeenCalled();
  });

  it('chama onCopyReceipt ao clicar em Copiar comprovante', async () => {
    const onCopyReceipt = vi.fn();
    render(<CheckoutSuccessPanel {...baseProps} onCopyReceipt={onCopyReceipt} />);
    await userEvent.click(screen.getByText('Copiar comprovante'));
    expect(onCopyReceipt).toHaveBeenCalled();
  });

  it('chama onClose ao clicar em Fechar resumo', async () => {
    const onClose = vi.fn();
    render(<CheckoutSuccessPanel {...baseProps} onClose={onClose} />);
    await userEvent.click(screen.getByText('Fechar resumo'));
    expect(onClose).toHaveBeenCalled();
  });

  it('nao mostra botao Acompanhar quando orderNo esta ausente', () => {
    render(
      <CheckoutSuccessPanel
        {...baseProps}
        data={{ ...baseData, orderNo: undefined }}
      />,
    );
    expect(screen.queryByText('Acompanhar pedido agora')).not.toBeInTheDocument();
  });
});
