import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config para isolar a baseUrl e o tenant default.
vi.mock('./config', () => ({
  API_BASE_URL: 'https://api.test/api/v1',
  TENANT_ID: 'tenant-default',
}));

import api from './api-client';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('api-client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('faz GET no /auth/me usando baseUrl + headers basicos', async () => {
    await api.getCurrentUser();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/auth/me');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Cache-Control']).toBe('no-store');
    expect(headers['x-tenant-id']).toBe('tenant-default');
    expect(headers.Authorization).toBeUndefined();
  });

  it('inclui Authorization Bearer quando ha token em localStorage', async () => {
    window.localStorage.setItem('token', 'jwt-xyz');
    await api.getCurrentUser();
    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-xyz');
  });

  it('preferencia tenant_id de localStorage sobre o default', async () => {
    window.localStorage.setItem('tenant_id', 'tenant-override');
    await api.getCurrentUser();
    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-tenant-id']).toBe('tenant-override');
  });

  it('login envia POST com body JSON e tenant header', async () => {
    await api.login('user@x.com', 'secret', 'tenant-custom');
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({ email: 'user@x.com', password: 'secret' }),
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['x-tenant-id']).toBe('tenant-custom');
  });

  it('searchProducts serializa query string', async () => {
    await api.searchProducts('brigadeiro', 'tenant-default');
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/products/search?q=brigadeiro');
  });

  it('lanca Error com mensagem do backend em status nao-ok', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ message: 'Tenant nao encontrado' }, { status: 404 }),
    );
    await expect(api.getCurrentUser()).rejects.toThrow('Tenant nao encontrado');
  });

  it('lanca Error generico quando backend nao retorna JSON em erro', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('upstream timeout', { status: 502 }),
    );
    await expect(api.getCurrentUser()).rejects.toThrow('Request failed');
  });
});
