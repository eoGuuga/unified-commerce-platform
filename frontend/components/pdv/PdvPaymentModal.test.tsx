import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PdvPaymentModal } from './PdvPaymentModal';

vi.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
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

  // ---- Task 5: debito/credito, fast-pass, cupom oculto, sucesso inequivoco ----

  it('renderiza botoes Debito e Credito e os seleciona via onPaymentMethodChange', () => {
    render(<PdvPaymentModal {...baseProps} />);

    const debito = screen.getByText('Débito');
    const credito = screen.getByText('Crédito');
    expect(debito).toBeInTheDocument();
    expect(credito).toBeInTheDocument();

    fireEvent.click(debito);
    expect(baseProps.onPaymentMethodChange).toHaveBeenCalledWith('debito');

    fireEvent.click(credito);
    expect(baseProps.onPaymentMethodChange).toHaveBeenCalledWith('credito');
  });

  it('com showCoupon={false} nao renderiza o campo de cupom', () => {
    const { container } = render(<PdvPaymentModal {...baseProps} showCoupon={false} />);
    expect(screen.queryByText('Cupom')).not.toBeInTheDocument();
    expect(container.querySelector('input[placeholder="EX: PROMO10"]')).toBeNull();
  });

  it('por padrao (showCoupon default) renderiza o campo de cupom', () => {
    render(<PdvPaymentModal {...baseProps} />);
    expect(screen.getByText('Cupom')).toBeInTheDocument();
  });

  it('fast-pass: nao mostra QR e usa um unico botao que chama onCreateOrderAndPayment', () => {
    const paymentData = {
      pagamento: { id: 'pay-1', status: 'pending', method: 'pix' as const, amount: 45.3 },
      qr_code: 'data:image/png;base64,abc',
      copy_paste: '000201...',
    };

    render(
      <PdvPaymentModal
        {...baseProps}
        fastPass
        orderData={null}
        paymentData={paymentData}
      />,
    );

    // Sem QR no fast-pass mesmo com paymentData presente.
    expect(screen.queryByAltText('QR Code Pix')).toBeNull();
    // Sem o 2o botao de confirmar (passo de QR).
    expect(screen.queryByText('Confirmar pagamento')).toBeNull();

    // Botao unico de fast-pass.
    const single = screen.getByText('Confirmar pagamento e finalizar');
    fireEvent.click(single);
    expect(baseProps.onCreateOrderAndPayment).toHaveBeenCalled();
    expect(baseProps.onConfirmPayment).not.toHaveBeenCalled();
  });

  it('completedSale renderiza "Venda registrada" + troco + "Nova venda" proeminente', () => {
    const completedSale = {
      orderNo: 'PDV-009',
      total: 50.0,
      paymentMethod: 'dinheiro' as const,
      itemsCount: 3,
      changeAmount: 10.0,
    };

    render(<PdvPaymentModal {...baseProps} completedSale={completedSale} />);

    expect(screen.getByText('Venda registrada')).toBeInTheDocument();
    expect(screen.getByText('PDV-009')).toBeInTheDocument();
    // Total e troco visiveis (o troco "R$ 10,00" aparece no destaque e no resumo).
    expect(screen.getByText('Troco')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 10,00').length).toBeGreaterThan(0);
    // Nova venda como acao primaria obvia.
    expect(screen.getByText('Nova venda')).toBeInTheDocument();
  });

  it('fast-pass com paymentLoading mostra "registrando..." e desabilita o botao', () => {
    render(<PdvPaymentModal {...baseProps} fastPass paymentLoading />);

    const button = screen.getByRole('button', { name: /registrando/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(baseProps.onCreateOrderAndPayment).not.toHaveBeenCalled();
  });
});
