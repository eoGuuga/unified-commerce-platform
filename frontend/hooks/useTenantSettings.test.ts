import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock do api-client antes de importar o hook (mesmo padrao de useProducts.test.ts).
vi.mock('@/lib/api-client', () => ({
  default: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

import { useTenantSettings } from './useTenantSettings';
import api from '@/lib/api-client';
import type { TenantSettingsProjection, UpdateTenantSettingsDto } from '@/lib/types/tenant-settings';

const apiMock = api as unknown as {
  getSettings: ReturnType<typeof vi.fn>;
  updateSettings: ReturnType<typeof vi.fn>;
};

const baseProjection: TenantSettingsProjection = {
  loja: {
    store_name: 'Doceria da Ana',
    tagline: null,
    description: 'Doces artesanais',
    logo_url: null,
    favicon_url: null,
    primary_color: '#FF00AA',
  },
  horario: { business_hours: null },
  pagamento: { metodos: ['pix'], pix_key: 'ana@pix.com', pix_merchant_name: 'Ana' },
  status: {
    hasBusinessHours: false,
    hasPixKey: true,
    hasPixMerchantName: true,
    hasWhatsappNumber: false,
  },
};

// Clona a projecao para cada teste (evita mutacao compartilhada entre casos).
function makeProjection(): TenantSettingsProjection {
  return JSON.parse(JSON.stringify(baseProjection)) as TenantSettingsProjection;
}

describe('useTenantSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getSettings.mockResolvedValue(makeProjection());
  });

  describe('fetch on mount', () => {
    it('popula settings e zera loading', async () => {
      const { result } = renderHook(() => useTenantSettings());

      // Antes do fetch resolver: loading true.
      expect(result.current.loading).toBe(true);

      await act(async () => {
        await Promise.resolve();
      });

      expect(apiMock.getSettings).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.settings?.loja.store_name).toBe('Doceria da Ana');
      expect(result.current.settings?.pagamento.metodos).toEqual(['pix']);
    });

    it('registra error e mantem settings null quando o fetch falha', async () => {
      apiMock.getSettings.mockRejectedValueOnce(new Error('rede caiu'));

      const { result } = renderHook(() => useTenantSettings());
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.settings).toBeNull();
      expect(result.current.error).toBe('rede caiu');
    });
  });

  describe('update — optimistic + rollback', () => {
    it('aplica a mudanca no estado local ANTES da resposta da API (otimista)', async () => {
      // API pendente para capturar o estado intermediario.
      let resolveApi!: (v: TenantSettingsProjection) => void;
      const apiPromise = new Promise<TenantSettingsProjection>((resolve) => {
        resolveApi = resolve;
      });
      apiMock.updateSettings.mockReturnValue(apiPromise);

      const { result } = renderHook(() => useTenantSettings());
      await act(async () => {
        await Promise.resolve();
      });

      const dto: UpdateTenantSettingsDto = { loja: { store_name: 'Novo Nome' } };

      // Dispara sem aguardar a API.
      act(() => {
        void result.current.update(dto);
      });

      // Estado local ja reflete a mudanca (otimista), antes da resposta.
      expect(result.current.settings?.loja.store_name).toBe('Novo Nome');

      const server = makeProjection();
      server.loja.store_name = 'Novo Nome';
      await act(async () => {
        resolveApi(server);
      });
    });

    it('chama apiClient.updateSettings com o dto e reflete o retorno do servidor no sucesso', async () => {
      const server = makeProjection();
      server.loja.store_name = 'Doceria da Ana Reforma';
      server.status.hasBusinessHours = true;
      apiMock.updateSettings.mockResolvedValue(server);

      const { result } = renderHook(() => useTenantSettings());
      await act(async () => {
        await Promise.resolve();
      });

      const dto: UpdateTenantSettingsDto = { loja: { store_name: 'Doceria da Ana Reforma' } };

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.update(dto);
      });

      expect(apiMock.updateSettings).toHaveBeenCalledWith(dto);
      expect(res!.ok).toBe(true);
      // Estado reflete o RETORNO do servidor (verdade canonica), nao so o otimismo.
      expect(result.current.settings?.loja.store_name).toBe('Doceria da Ana Reforma');
      expect(result.current.settings?.status.hasBusinessHours).toBe(true);
    });

    it('no erro faz ROLLBACK ao snapshot anterior e retorna {ok:false}', async () => {
      apiMock.updateSettings.mockRejectedValue(new Error('timeout'));

      const { result } = renderHook(() => useTenantSettings());
      await act(async () => {
        await Promise.resolve();
      });

      // Estado inicial conhecido.
      expect(result.current.settings?.loja.store_name).toBe('Doceria da Ana');

      const dto: UpdateTenantSettingsDto = { loja: { store_name: 'Nome Que Vai Falhar' } };

      let res: { ok: boolean; error?: string } | undefined;
      await act(async () => {
        res = await result.current.update(dto);
      });

      // Reverteu ao snapshot anterior.
      expect(result.current.settings?.loja.store_name).toBe('Doceria da Ana');
      expect(res!.ok).toBe(false);
      expect(res!.error).toBe('timeout');
    });

    it('merge por secao: update de horario nao apaga campos de loja/pagamento', async () => {
      const bh = {
        tz: 'America/Sao_Paulo',
        days: { '6': { open: '09:00', close: '13:00' } },
      };
      const server = makeProjection();
      server.horario.business_hours = bh;
      server.status.hasBusinessHours = true;
      apiMock.updateSettings.mockResolvedValue(server);

      const { result } = renderHook(() => useTenantSettings());
      await act(async () => {
        await Promise.resolve();
      });

      const dto: UpdateTenantSettingsDto = { horario: { business_hours: bh } };
      await act(async () => {
        await result.current.update(dto);
      });

      // Otimismo por-secao preservou loja/pagamento; horario refletiu o servidor.
      expect(result.current.settings?.loja.store_name).toBe('Doceria da Ana');
      expect(result.current.settings?.pagamento.pix_key).toBe('ana@pix.com');
      expect(result.current.settings?.horario.business_hours).toEqual(bh);
    });
  });

  describe('refetch', () => {
    it('recarrega settings do api-client', async () => {
      const { result } = renderHook(() => useTenantSettings());
      await act(async () => {
        await Promise.resolve();
      });

      const novo = makeProjection();
      novo.loja.store_name = 'Nome Recarregado';
      apiMock.getSettings.mockResolvedValueOnce(novo);

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiMock.getSettings).toHaveBeenCalledTimes(2);
      expect(result.current.settings?.loja.store_name).toBe('Nome Recarregado');
    });
  });
});
