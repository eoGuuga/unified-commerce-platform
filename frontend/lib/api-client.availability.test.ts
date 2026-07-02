import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config para isolar a baseUrl e o tenant default (mesmo padrao do api-client.tenant-settings.test.ts).
vi.mock('./config', () => ({
  API_BASE_URL: 'https://api.test/api/v1',
  TENANT_ID: 'tenant-default',
}));

import api from './api-client';
import type { CreateStoreExceptionInput } from './types/store-exception';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const exceptions = [
  { id: 'exc-1', date: '2026-07-10', kind: 'closed', open: null, close: null },
  {
    id: 'exc-2',
    date: '2026-07-15',
    kind: 'custom_hours',
    open: '09:00',
    close: '13:00',
  },
];

describe('api-client availability exceptions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(exceptions));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listExceptions faz GET em /availability-exceptions com headers basicos', async () => {
    const res = await api.listExceptions();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/availability-exceptions');
    // GET => method undefined (default do fetch).
    expect(init.method).toBeUndefined();
    const headers = init.headers as Record<string, string>;
    expect(headers['x-tenant-id']).toBe('tenant-default');
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe('exc-1');
  });

  it('createException faz POST em /availability-exceptions com o input no body JSON', async () => {
    const input: CreateStoreExceptionInput = {
      date: '2026-08-01',
      kind: 'custom_hours',
      open: '10:00',
      close: '16:00',
    };

    await api.createException(input);

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/availability-exceptions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it('removeException faz DELETE em /availability-exceptions/:id', async () => {
    await api.removeException('exc-1');

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/availability-exceptions/exc-1');
    expect(init.method).toBe('DELETE');
  });

  it('closeToday faz POST em /availability-exceptions/close-today', async () => {
    await api.closeToday();

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/availability-exceptions/close-today');
    expect(init.method).toBe('POST');
  });

  it('propaga a mensagem de erro do backend em status nao-ok', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ message: 'Forbidden' }, { status: 403 }),
    );
    await expect(
      api.createException({ date: '2026-08-01', kind: 'closed' }),
    ).rejects.toThrow('Forbidden');
  });
});
