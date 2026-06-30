import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config para isolar a baseUrl e o tenant default (mesmo padrao do api-client.test.ts).
vi.mock('./config', () => ({
  API_BASE_URL: 'https://api.test/api/v1',
  TENANT_ID: 'tenant-default',
}));

import api from './api-client';
import type { CreateOrderInput } from './types';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const pdvInput: CreateOrderInput = {
  channel: 'pdv',
  payment: { method: 'dinheiro' },
  items: [{ produto_id: 'prod-1', quantity: 2, unit_price: 5.5 }],
};

describe('api-client createOrder (PDV)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ id: 'order-1', order_no: 'PDV-1' }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('faz POST em /orders com payment.method no body e header Idempotency-Key quando opts.idempotencyKey e dado', async () => {
    await api.createOrder(pdvInput, { idempotencyKey: 'abc' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];

    expect(url).toBe('https://api.test/api/v1/orders');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string) as CreateOrderInput;
    expect(body.channel).toBe('pdv');
    expect(body.payment?.method).toBe('dinheiro');
    expect(body.items).toEqual([
      { produto_id: 'prod-1', quantity: 2, unit_price: 5.5 },
    ]);

    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('abc');
  });

  it('nao envia header Idempotency-Key quando opts.idempotencyKey ausente', async () => {
    await api.createOrder(pdvInput);

    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });
});
