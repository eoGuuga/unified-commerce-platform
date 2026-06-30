/**
 * Teste integrado da tela de caixa (`/pdv/caixa`) — "caixa funcionando de verdade".
 *
 * O que cobrimos (fluxo ponta-a-ponta, com a LOGICA real do usePdvSale rodando;
 * so `createOrder` e os dados/auth sao mockados):
 *  - auth OK + produtos mockados -> renderiza busca + carrinho;
 *  - adicionar produto -> item e total no carrinho;
 *  - PAGAR -> modal abre -> Dinheiro -> valor recebido -> "Confirmar pagamento e finalizar"
 *    -> createOrder chamado UMA vez com channel:'pdv' + payment.method:'dinheiro'
 *    -> "✅ Venda registrada" com o troco -> "Nova venda" limpa o carrinho e volta a busca;
 *  - sem auth -> redireciona para /login (mecanismo de redirect do next/navigation).
 *
 * Mocks (padrao do repo — ver AdminShell.test.tsx / AdminNav.test.tsx):
 *  - @/hooks/useAuth  -> estado de sessao
 *  - @/hooks/useProducts -> lista de produtos (reusa a camada de dados)
 *  - @/lib/api-client (default.createOrder) -> a unica chamada de rede no fluxo
 *  - next/navigation (useRouter) -> assert do redirect
 *  - next/image -> <img> simples (o modal usa next/image)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ---- Mocks ----

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  default: {
    createOrder: vi.fn(),
  },
}));

const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  default: (props: any) => <img {...props} />,
}));

import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import api from '@/lib/api-client';
import CaixaPage from './page';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseProducts = useProducts as ReturnType<typeof vi.fn>;
const mockApi = api as unknown as { createOrder: ReturnType<typeof vi.fn> };

const products = [
  {
    id: 'p1',
    name: 'Brigadeiro',
    price: 2.5,
    is_active: true,
    stock: 10,
    tenant_id: 't1',
    unit: 'unidade',
  },
  {
    id: 'p2',
    name: 'Beijinho',
    price: 3,
    is_active: true,
    stock: 5,
    tenant_id: 't1',
    unit: 'unidade',
  },
];

function authOk() {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'g@g.com', full_name: 'Gustavo', role: 'admin', tenant_id: 't1' },
    token: 'jwt',
    tenantId: 't1',
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

function productsOk() {
  mockUseProducts.mockReturnValue({
    products,
    loading: false,
    error: null,
    refetch: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggleActive: vi.fn(),
    mutatingId: null,
  });
}

describe('CaixaPage — /pdv/caixa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fluxo completo: busca + carrinho -> pagar dinheiro -> venda registrada com troco -> nova venda', async () => {
    authOk();
    productsOk();
    mockApi.createOrder.mockResolvedValue({
      id: 'order-1',
      order_no: 'PDV-77',
      status: 'entregue',
      channel: 'pdv',
    });

    render(<CaixaPage />);

    // Renderiza busca + carrinho.
    expect(screen.getByLabelText('Buscar produto')).toBeInTheDocument();
    expect(screen.getByText('Carrinho')).toBeInTheDocument();

    // Adiciona o Brigadeiro (clicar no card).
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Brigadeiro' }));

    // Carrinho mostra o item e o total (1 x R$ 2,50).
    expect(screen.getByTestId('pdv-cart-item-name')).toHaveTextContent('Brigadeiro');
    expect(screen.getByTestId('pdv-cart-total')).toHaveTextContent('R$ 2,50');

    // PAGAR abre o modal.
    fireEvent.click(screen.getByRole('button', { name: /PAGAR/i }));
    expect(screen.getByText('Pagamento')).toBeInTheDocument();

    // Escolhe Dinheiro e informa o valor recebido (R$ 5,00 -> troco R$ 2,50).
    fireEvent.click(screen.getByText('Dinheiro'));
    const cashInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(cashInput, { target: { value: '5' } });

    // Confirma o pagamento e finaliza.
    fireEvent.click(screen.getByText('Confirmar pagamento e finalizar'));

    // createOrder chamado UMA vez com o contrato do PDV.
    await waitFor(() => expect(mockApi.createOrder).toHaveBeenCalledTimes(1));
    const [payload, opts] = mockApi.createOrder.mock.calls[0];
    expect(payload.channel).toBe('pdv');
    expect(payload.payment.method).toBe('dinheiro');
    expect(payload.items).toEqual([{ produto_id: 'p1', quantity: 1, unit_price: 2.5 }]);
    expect(opts?.idempotencyKey).toBeTruthy();

    // Sucesso inequivoco: "✅ Venda registrada" + troco visivel.
    expect(await screen.findByText('Venda registrada')).toBeInTheDocument();
    expect(screen.getByText('PDV-77')).toBeInTheDocument();
    expect(screen.getByText('Troco')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 2,50').length).toBeGreaterThan(0);

    // "Nova venda" limpa o carrinho e volta a busca.
    fireEvent.click(screen.getByText('Nova venda'));
    await waitFor(() =>
      expect(screen.queryByText('Venda registrada')).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId('pdv-cart-item-name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar produto')).toBeInTheDocument();
    // createOrder NAO foi chamado de novo so por iniciar nova venda.
    expect(mockApi.createOrder).toHaveBeenCalledTimes(1);
  });

  it('sem auth: redireciona para /login', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      tenantId: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    productsOk();

    render(<CaixaPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    // Nao vaza o conteudo do caixa enquanto desautenticado.
    expect(screen.queryByLabelText('Buscar produto')).not.toBeInTheDocument();
  });
});
