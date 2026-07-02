/**
 * Testes do usePdvSale — o coracao testavel da venda do PDV.
 *
 * Casos que o dono quer ver com atencao:
 *  - Estoque insuficiente PRESERVA o carrinho (a operadora ajusta o item, nao perde a venda).
 *  - Idempotencia: a Idempotency-Key e gerada UMA vez por venda e reusada no retry apos erro;
 *    `newSale` regenera. Sem duplo-POST com paymentLoading em voo.
 *
 * Erro REAL do PDV para estoque insuficiente: BadRequestException 400 com message
 * "Estoque insuficiente para produto ..." e SEM `code` (pre-check do orders.service +
 * reserve do stock-engine). O `code='INSUFFICIENT_STOCK'` (422) vem do endpoint de
 * movimento MANUAL de estoque — o PDV nao usa, fica como fallback defensivo.
 * O preco divergente vem como Error 400 com message contendo "divergente" e SEM code.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mocka só o default (createOrder), mantendo normalizeApiError real via importActual.
vi.mock('@/lib/api-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    default: {
      createOrder: vi.fn(),
    },
  };
});

import api from '@/lib/api-client';
import { usePdvSale } from './usePdvSale';

const mockApi = api as unknown as { createOrder: ReturnType<typeof vi.fn> };

const brigadeiro = { id: 'p1', name: 'Brigadeiro', price: 2.5, stock: 10 };
const beijinho = { id: 'p2', name: 'Beijinho', price: 3, stock: 5 };

const okOrder = {
  id: 'order-1',
  order_no: 'PDV-42',
  status: 'entregue',
  channel: 'pdv',
};

/** Adiciona 2 itens e seleciona um metodo, deixando a venda pronta para submit. */
function seedSale(result: { current: ReturnType<typeof usePdvSale> }) {
  act(() => {
    result.current.addProduct(brigadeiro); // 2.5
    result.current.addProduct(beijinho); // + 3 = 5.5
    result.current.setMethod('dinheiro');
  });
}

describe('usePdvSale — carrinho + total', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.createOrder.mockResolvedValue(okOrder);
  });
  afterEach(() => vi.restoreAllMocks());

  it('addProduct/inc/dec/remove/clear e total ao vivo', () => {
    const { result } = renderHook(() => usePdvSale());

    act(() => result.current.addProduct(brigadeiro));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(2.5);

    act(() => result.current.addProduct(brigadeiro)); // qty 2
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.total).toBe(5);

    act(() => result.current.dec('p1')); // qty 1
    expect(result.current.items[0].quantity).toBe(1);

    act(() => result.current.dec('p1')); // trava no 1
    expect(result.current.items[0].quantity).toBe(1);

    act(() => result.current.inc('p1')); // qty 2
    expect(result.current.total).toBe(5);

    act(() => result.current.addProduct(beijinho)); // + 3 = 8
    expect(result.current.total).toBe(8);

    act(() => result.current.remove('p1'));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(3);

    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('change = cashReceived - total quando dinheiro', () => {
    const { result } = renderHook(() => usePdvSale());
    seedSale(result); // total 5.5
    act(() => result.current.setCashReceived(10));
    expect(result.current.change).toBe(4.5);
  });
});

describe('usePdvSale — submitSale sucesso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.createOrder.mockResolvedValue(okOrder);
  });
  afterEach(() => vi.restoreAllMocks());

  it('CASO 4 — sucesso seta completedSale (order_no, total, method, change)', async () => {
    const { result } = renderHook(() => usePdvSale());
    seedSale(result); // total 5.5
    act(() => result.current.setCashReceived(10)); // change 4.5

    await act(async () => {
      await result.current.submitSale();
    });

    expect(mockApi.createOrder).toHaveBeenCalledTimes(1);
    expect(result.current.completedSale).toEqual({
      order_no: 'PDV-42',
      total: 5.5,
      method: 'dinheiro',
      change: 4.5,
    });
    expect(result.current.paymentError).toBeNull();
    expect(result.current.paymentLoading).toBe(false);
  });

  it('envia o payload correto (channel pdv, payment.method, itens com unit_price)', async () => {
    const { result } = renderHook(() => usePdvSale());
    seedSale(result);

    await act(async () => {
      await result.current.submitSale();
    });

    const [payload] = mockApi.createOrder.mock.calls[0];
    expect(payload.channel).toBe('pdv');
    expect(payload.payment).toEqual({ method: 'dinheiro' });
    expect(payload.items).toEqual([
      { produto_id: 'p1', quantity: 1, unit_price: 2.5 },
      { produto_id: 'p2', quantity: 1, unit_price: 3 },
    ]);
    expect(payload.customer_name).toBe('Cliente Balcão');
  });
});

describe('usePdvSale — estoque insuficiente preserva o carrinho', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('CASO 1 — erro REAL do PDV (400 SEM code, message "Estoque insuficiente para produto") preserva o carrinho e seta paymentError claro', async () => {
    // O caminho real do PDV: BadRequestException 400, message nomeando o produto,
    // SEM code. O describeSaleError casa via regex /estoque insuficiente/i.
    const err = new Error('Estoque insuficiente para produto Brigadeiro. Disponível: 0.');
    mockApi.createOrder.mockRejectedValueOnce(err);

    const { result } = renderHook(() => usePdvSale());
    seedSale(result); // 2 itens, total 5.5

    await act(async () => {
      await result.current.submitSale();
    });

    // O carrinho continua INTACTO — a operadora ajusta o item e tenta de novo.
    expect(result.current.items).toHaveLength(2);
    expect(result.current.total).toBe(5.5);
    // Nao houve sucesso.
    expect(result.current.completedSale).toBeNull();
    // Mensagem amigavel mencionando estoque (veio pela regex, sem code).
    expect(result.current.paymentError).toBeTruthy();
    expect(result.current.paymentError).toMatch(/estoque/i);
    expect(result.current.paymentLoading).toBe(false);
  });

  it('CASO 1b (defesa) — fallback 422 com code INSUFFICIENT_STOCK tambem preserva o carrinho', async () => {
    // Outro endpoint (movimento manual de estoque) usa code 422; o PDV nao,
    // mas o hook trata os dois — mantemos como rede de seguranca.
    const err = Object.assign(new Error('Estoque insuficiente para esta saída.'), {
      code: 'INSUFFICIENT_STOCK',
    });
    mockApi.createOrder.mockRejectedValueOnce(err);

    const { result } = renderHook(() => usePdvSale());
    seedSale(result); // 2 itens, total 5.5

    await act(async () => {
      await result.current.submitSale();
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.total).toBe(5.5);
    expect(result.current.completedSale).toBeNull();
    expect(result.current.paymentError).toMatch(/estoque/i);
    expect(result.current.paymentLoading).toBe(false);
  });
});

describe('usePdvSale — preco divergente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('CASO 5 — preco divergente da mensagem especifica de re-sync e preserva o carrinho', async () => {
    // Backend: BadRequestException 400, message com "divergente", SEM code.
    const err = new Error('Preço do produto divergente para p1. Preço atual: 4.00');
    mockApi.createOrder.mockRejectedValueOnce(err);

    const { result } = renderHook(() => usePdvSale());
    seedSale(result);

    await act(async () => {
      await result.current.submitSale();
    });

    expect(result.current.items).toHaveLength(2); // carrinho preservado
    expect(result.current.completedSale).toBeNull();
    // Mensagem especifica (re-sync de preco), diferente da de estoque.
    expect(result.current.paymentError).toMatch(/pre[çc]o/i);
    expect(result.current.paymentError).not.toMatch(/estoque/i);
  });

  // B4 — o caso genérico não pode vazar o texto técnico cru do backend.
  it('B4: erro técnico 500 vira mensagem amigável, não vaza o texto cru', async () => {
    const err = Object.assign(
      new Error('QueryFailedError: duplicate key value violates unique constraint'),
      { status: 500 },
    );
    mockApi.createOrder.mockRejectedValueOnce(err);

    const { result } = renderHook(() => usePdvSale());
    seedSale(result);

    await act(async () => {
      await result.current.submitSale();
    });

    expect(result.current.items).toHaveLength(2); // carrinho preservado
    expect(result.current.paymentError).toBeTruthy();
    expect(result.current.paymentError).not.toMatch(/QueryFailedError|constraint|duplicate/i);
  });
});

describe('usePdvSale — idempotencia e anti-duplo-POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('CASO 2 — a Idempotency-Key e gerada 1x por venda e estavel no retry apos erro; newSale regenera', async () => {
    // Sequencia determinista de UUIDs.
    const uuids = ['uuid-venda-A', 'uuid-venda-B'];
    let i = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => uuids[i++] as `${string}-${string}-${string}-${string}-${string}`,
    );

    const { result } = renderHook(() => usePdvSale());
    seedSale(result);

    // 1o submit FALHA (erro de rede) — a key da venda A foi gerada.
    mockApi.createOrder.mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      await result.current.submitSale();
    });

    // 2o submit (retry da MESMA venda) — sucesso.
    mockApi.createOrder.mockResolvedValueOnce(okOrder);
    await act(async () => {
      await result.current.submitSale();
    });

    expect(mockApi.createOrder).toHaveBeenCalledTimes(2);
    const firstKey = mockApi.createOrder.mock.calls[0][1]?.idempotencyKey;
    const secondKey = mockApi.createOrder.mock.calls[1][1]?.idempotencyKey;
    // A MESMA key nos dois submits (retry reusa) — anti-cobranca-dupla.
    expect(firstKey).toBe('uuid-venda-A');
    expect(secondKey).toBe('uuid-venda-A');

    // newSale limpa tudo e REGENERA a key para a proxima venda.
    act(() => result.current.newSale());
    expect(result.current.items).toEqual([]);
    expect(result.current.completedSale).toBeNull();
    expect(result.current.paymentError).toBeNull();

    mockApi.createOrder.mockResolvedValueOnce(okOrder);
    act(() => {
      result.current.addProduct(brigadeiro);
      result.current.setMethod('pix');
    });
    await act(async () => {
      await result.current.submitSale();
    });
    const thirdKey = mockApi.createOrder.mock.calls[2][1]?.idempotencyKey;
    expect(thirdKey).toBe('uuid-venda-B'); // nova venda, nova key
  });

  it('CASO 3 — sem duplo-POST: 2a chamada a submitSale com paymentLoading em voo nao dispara outro createOrder', async () => {
    // createOrder pendente para capturar o estado "em voo".
    let resolveCall!: (v: unknown) => void;
    mockApi.createOrder.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCall = resolve;
      }),
    );

    const { result } = renderHook(() => usePdvSale());
    seedSale(result);

    // 1a chamada — fica pendente (paymentLoading=true).
    let firstSubmit!: Promise<void>;
    act(() => {
      firstSubmit = result.current.submitSale();
    });
    expect(result.current.paymentLoading).toBe(true);

    // 2a chamada (duplo-clique) ENQUANTO em voo — deve ser no-op.
    await act(async () => {
      await result.current.submitSale();
    });
    expect(mockApi.createOrder).toHaveBeenCalledTimes(1); // NAO disparou um 2o POST

    // Conclui a 1a chamada.
    await act(async () => {
      resolveCall(okOrder);
      await firstSubmit;
    });
    expect(mockApi.createOrder).toHaveBeenCalledTimes(1);
    expect(result.current.completedSale?.order_no).toBe('PDV-42');
  });
});

describe('usePdvSale — guardas de submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.createOrder.mockResolvedValue(okOrder);
  });
  afterEach(() => vi.restoreAllMocks());

  it('nao chama createOrder com carrinho vazio', async () => {
    const { result } = renderHook(() => usePdvSale());
    act(() => result.current.setMethod('pix'));
    await act(async () => {
      await result.current.submitSale();
    });
    expect(mockApi.createOrder).not.toHaveBeenCalled();
  });

  it('beginPayment limpa erro anterior (recomeca o passo de pagamento limpo)', async () => {
    mockApi.createOrder.mockRejectedValueOnce(
      Object.assign(new Error('Estoque insuficiente'), { code: 'INSUFFICIENT_STOCK' }),
    );
    const { result } = renderHook(() => usePdvSale());
    seedSale(result);

    await act(async () => {
      await result.current.submitSale();
    });
    expect(result.current.paymentError).toBeTruthy();

    act(() => result.current.beginPayment());
    expect(result.current.paymentError).toBeNull();
  });
});
