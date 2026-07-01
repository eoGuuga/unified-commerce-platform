import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock config para isolar a baseUrl e o tenant default (mesmo padrao do api-client.test.ts).
vi.mock('./config', () => ({
  API_BASE_URL: 'https://api.test/api/v1',
  TENANT_ID: 'tenant-default',
}));

import api from './api-client';
import type { UpdateTenantSettingsDto } from './types/tenant-settings';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const projection = {
  loja: {
    store_name: 'Loja X',
    tagline: null,
    description: null,
    logo_url: null,
    favicon_url: null,
    primary_color: null,
  },
  horario: { business_hours: null },
  pagamento: { metodos: ['pix'], pix_key: null, pix_merchant_name: null },
  status: {
    hasBusinessHours: false,
    hasPixKey: false,
    hasPixMerchantName: false,
    hasWhatsappNumber: false,
  },
};

describe('api-client tenant settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(projection));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getSettings faz GET em /tenants/settings com headers basicos', async () => {
    const res = await api.getSettings();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/tenants/settings');
    // GET => method undefined (default do fetch).
    expect(init.method).toBeUndefined();
    const headers = init.headers as Record<string, string>;
    expect(headers['x-tenant-id']).toBe('tenant-default');
    expect(res.loja.store_name).toBe('Loja X');
  });

  it('updateSettings faz PATCH em /tenants/settings com o dto no body JSON', async () => {
    const dto: UpdateTenantSettingsDto = {
      loja: { store_name: 'Novo Nome' },
      horario: {
        business_hours: {
          tz: 'America/Sao_Paulo',
          days: { '6': { open: '09:00', close: '13:00' } },
        },
      },
    };

    await api.updateSettings(dto);

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/tenants/settings');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual(dto);
  });

  it('propaga a mensagem de erro do backend em status nao-ok', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ message: 'Forbidden' }, { status: 403 }),
    );
    await expect(api.updateSettings({ loja: { store_name: 'x' } })).rejects.toThrow(
      'Forbidden',
    );
  });
});
