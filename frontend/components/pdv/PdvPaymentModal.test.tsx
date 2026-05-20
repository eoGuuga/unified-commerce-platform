import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PdvPaymentModal } from './PdvPaymentModal';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const baseProps = {
  saleSummaryItems: [
    { id: '1', name: 'Pao Frances', price: 0.75, quantity: 10 },
    { id: '2', name: 'Cafe 500g', price: 18.9, quantity: 2 },
  ],
  saleSummaryTotal: 45.3,
  orderData: { id: 'order-1', total: 45.3, orderNo: 'PDV-001' },
  paymentMethod: 'pix' as const,
  onPaymentMethodChange: vi.fn(),
  cashReceived: '',
  onCashReceivedChange: vi.fn(),
  cashChange: 0,
  couponCode: '',
  onCouponCodeChange: vi.fn(),
  paymentLoading: false,
  paymentError: null,
  paymentData: null,
  completedSale: null,
  onCreateOrderAndPayment: vi.fn(),
  onConfirmPayment: vi.fn(),
  onCopyReceipt: vi.fn(),
  onNewSale: vi.fn(),
  onClose: vi.fn(),
};

describe('PdvPaymentModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza formulario de pagamento quando completedSale eh null', () => {
    render(<PdvPaymentModal {...baseProps} />);

    expect(screen.getByText('Pagamento')).toBeInTheDocument();
    expect(screen.getByText('PIX')).toBeInTheDocument();
    expect(screen.getByText('Dinheiro')).toBeInTheDocument();
    expect(screen.getByText('Pao Frances')).toBeInTheDocument();
    expect(screen.getByText('Cafe 500g')).toBeInTheDocument();
  });

  it('exibe numero do pedido quando disponivel', () => {
    render(<PdvPaymentModal {...baseProps} />);

    expect(screen.getByText('Pedido: PDV-001')).toBeInTheDocument();
  });

  it('chama onPaymentMethodChange ao clicar em Dinheiro', () => {
    render(<PdvPaymentModal {...baseProps} />);

    fireEvent.click(screen.getByText('Dinheiro'));
    expect(baseProps.onPaymentMethodChange).toHaveBeenCalledWith('dinheiro');
  });

  it('chama onCreateOrderAndPayment ao clicar no botao de gerar pagamento', () => {
    render(<PdvPaymentModal {...baseProps} />);

    fireEvent.click(screen.getByText('Gerar pagamento novamente'));
    expect(baseProps.onCreateOrderAndPayment).toHaveBeenCalled();
  });

  it('chama onClose ao clicar em Fechar', () => {
    render(<PdvPaymentModal {...baseProps} />);

    fireEvent.click(screen.getByText('Fechar'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('exibe erro de pagamento quando paymentError esta definido', () => {
    render(<PdvPaymentModal {...baseProps} paymentError="Falha no gateway" />);

    expect(screen.getByText('Falha no gateway')).toBeInTheDocument();
  });

  it('renderiza venda concluida quando completedSale esta definido', () => {
    const completedSale = {
      orderNo: 'PDV-001',
      total: 45.3,
      paymentMethod: 'pix' as const,
      itemsCount: 12,
    };

    render(<PdvPaymentModal {...baseProps} completedSale={completedSale} />);

    expect(screen.getByText('venda confirmada')).toBeInTheDocument();
    expect(screen.getByText('PDV-001')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('chama onCopyReceipt ao clicar em Copiar comprovante', () => {
    const completedSale = {
      orderNo: 'PDV-001',
      total: 45.3,
      paymentMethod: 'pix' as const,
      itemsCount: 12,
    };

    render(<PdvPaymentModal {...baseProps} completedSale={completedSale} />);

    fireEvent.click(screen.getByText('Copiar comprovante'));
    expect(baseProps.onCopyReceipt).toHaveBeenCalled();
  });

  it('chama onNewSale ao clicar em Nova venda', () => {
    const completedSale = {
      orderNo: 'PDV-001',
      total: 45.3,
      paymentMethod: 'pix' as const,
      itemsCount: 12,
    };

    render(<PdvPaymentModal {...baseProps} completedSale={completedSale} />);

    fireEvent.click(screen.getByText('Nova venda'));
    expect(baseProps.onNewSale).toHaveBeenCalled();
  });

  it('exibe troco na venda concluida quando paymentMethod eh dinheiro', () => {
    const completedSale = {
      orderNo: 'PDV-002',
      total: 30.0,
      paymentMethod: 'dinheiro' as const,
      itemsCount: 5,
      changeAmount: 20.0,
    };

    render(<PdvPaymentModal {...baseProps} completedSale={completedSale} />);

    expect(screen.getByText('Troco')).toBeInTheDocument();
  });
});
