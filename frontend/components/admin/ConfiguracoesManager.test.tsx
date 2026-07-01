/**
 * Testes do ConfiguracoesManager — tela /admin/configuracoes (T7).
 *
 * Mock do hook useTenantSettings (mesmo padrao dos testes de StockManager que
 * mockam o provider). Cobre:
 *  (a) renderiza as 3 secoes (Loja/Horario/Pagamento) com os valores da projecao;
 *  (b) editar store_name + salvar a secao Loja chama update({ loja: { store_name } });
 *  (c) HORARIO POR-DIA: sabado (dow 6) aberto 09:00-13:00, domingo fechado -> ao
 *      salvar, update recebe horario.business_hours.days com a chave "6" e SEM a
 *      chave "0" (domingo ausente = fechado);
 *  (d) SINALIZACAO: com status.hasBusinessHours=false, o aviso de horario aparece.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ---- Mock do hook de dados (T6) ----

vi.mock('@/hooks/useTenantSettings', () => ({
  useTenantSettings: vi.fn(),
}));

import { useTenantSettings } from '@/hooks/useTenantSettings';
import { ConfiguracoesManager } from './ConfiguracoesManager';
import type { TenantSettingsProjection } from '@/lib/types/tenant-settings';

const mockUseTenantSettings = useTenantSettings as ReturnType<typeof vi.fn>;

function makeProjection(
  overrides: Partial<TenantSettingsProjection> = {},
): TenantSettingsProjection {
  const base: TenantSettingsProjection = {
    loja: {
      store_name: 'Doceria da Ana',
      tagline: 'Doces que abraçam',
      description: 'Doces artesanais',
      logo_url: 'https://cdn.exemplo.com/logo.png',
      favicon_url: null,
      primary_color: '#b8654a',
    },
    horario: { business_hours: null },
    pagamento: {
      metodos: ['pix', 'dinheiro'],
      pix_key: 'ana@pix.com',
      pix_merchant_name: 'Ana Doceira',
    },
    status: {
      hasBusinessHours: false,
      hasPixKey: true,
      hasPixMerchantName: true,
      hasWhatsappNumber: false,
    },
  };
  return {
    ...base,
    ...overrides,
    loja: { ...base.loja, ...(overrides.loja ?? {}) },
    horario: { ...base.horario, ...(overrides.horario ?? {}) },
    pagamento: { ...base.pagamento, ...(overrides.pagamento ?? {}) },
    status: { ...base.status, ...(overrides.status ?? {}) },
  };
}

function makeHook(overrides: Record<string, unknown> = {}) {
  return {
    settings: makeProjection(),
    loading: false,
    error: null,
    update: vi.fn().mockResolvedValue({ ok: true }),
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('ConfiguracoesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Estados de base (loading / error / empty) ----

  it('exibe loading enquanto carrega', () => {
    mockUseTenantSettings.mockReturnValue(makeHook({ settings: null, loading: true }));
    render(<ConfiguracoesManager />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('exibe erro e botao de retry', () => {
    const refetch = vi.fn();
    mockUseTenantSettings.mockReturnValue(
      makeHook({ settings: null, error: 'Falha na conexão', refetch }),
    );
    render(<ConfiguracoesManager />);
    expect(screen.getByText('Falha na conexão')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/tentar novamente/i));
    expect(refetch).toHaveBeenCalled();
  });

  // ---- (a) 3 secoes com valores da projecao ----

  it('renderiza as 3 secoes (Loja/Horario/Pagamento) com os valores da projecao', () => {
    mockUseTenantSettings.mockReturnValue(makeHook());
    render(<ConfiguracoesManager />);

    // Titulos de secao
    expect(screen.getByRole('heading', { name: /Loja/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Horário/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Pagamento/i })).toBeInTheDocument();

    // Valores da secao Loja
    expect((screen.getByLabelText(/Nome da loja/i) as HTMLInputElement).value).toBe(
      'Doceria da Ana',
    );
    expect((screen.getByLabelText(/Descrição/i) as HTMLInputElement).value).toBe(
      'Doces artesanais',
    );
    expect((screen.getByLabelText(/Logo/i) as HTMLInputElement).value).toBe(
      'https://cdn.exemplo.com/logo.png',
    );

    // Valores da secao Pagamento
    expect((screen.getByLabelText(/Chave PIX/i) as HTMLInputElement).value).toBe(
      'ana@pix.com',
    );
    // metodos: pix e dinheiro marcados
    expect((screen.getByLabelText(/^PIX$/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Dinheiro/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Débito/i) as HTMLInputElement).checked).toBe(false);
  });

  // ---- (b) editar store_name + salvar Loja -> update({ loja: { store_name } }) ----

  it('editar store_name + salvar Loja chama update com { loja: { store_name } }', async () => {
    const update = vi.fn().mockResolvedValue({ ok: true });
    mockUseTenantSettings.mockReturnValue(makeHook({ update }));
    render(<ConfiguracoesManager />);

    const nome = screen.getByLabelText(/Nome da loja/i);
    fireEvent.change(nome, { target: { value: 'Doceria Renovada' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar loja/i }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    const arg = update.mock.calls[0][0];
    expect(arg).toHaveProperty('loja');
    expect(arg.loja.store_name).toBe('Doceria Renovada');
  });

  // ---- (b2) FIX 1: salvar Loja com so o nome -> omite logo_url/primary_color vazios ----

  it('salvar Loja com so o nome (logo e cor vazios) chama update sem logo_url nem primary_color', async () => {
    const update = vi.fn().mockResolvedValue({ ok: true });
    // Projecao de lojista novo: logo/cor/tagline/descricao vazios (null).
    mockUseTenantSettings.mockReturnValue(
      makeHook({
        update,
        settings: makeProjection({
          loja: {
            store_name: null,
            tagline: null,
            description: null,
            logo_url: null,
            favicon_url: null,
            primary_color: null,
          } as never,
        }),
      }),
    );
    render(<ConfiguracoesManager />);

    const nome = screen.getByLabelText(/Nome da loja/i);
    fireEvent.change(nome, { target: { value: 'Minha Loja' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar loja/i }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    const arg = update.mock.calls[0][0];
    // So o nome vai no payload; campos vazios sao OMITIDOS (nao mandados como '').
    expect(arg).toEqual({ loja: { store_name: 'Minha Loja' } });
    expect(Object.prototype.hasOwnProperty.call(arg.loja, 'logo_url')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(arg.loja, 'primary_color')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(arg.loja, 'tagline')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(arg.loja, 'description')).toBe(false);
  });

  it('salvar Pagamento com pix vazio omite pix_key e pix_merchant_name', async () => {
    const update = vi.fn().mockResolvedValue({ ok: true });
    mockUseTenantSettings.mockReturnValue(
      makeHook({
        update,
        settings: makeProjection({
          pagamento: {
            metodos: [],
            pix_key: null,
            pix_merchant_name: null,
          } as never,
        }),
      }),
    );
    render(<ConfiguracoesManager />);

    // Marca so o metodo Dinheiro (sem preencher PIX).
    fireEvent.click(screen.getByLabelText(/Dinheiro/i));
    fireEvent.click(screen.getByRole('button', { name: /Salvar pagamento/i }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    const arg = update.mock.calls[0][0];
    expect(arg.pagamento.metodos).toEqual(['dinheiro']);
    expect(Object.prototype.hasOwnProperty.call(arg.pagamento, 'pix_key')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(arg.pagamento, 'pix_merchant_name')).toBe(false);
  });

  // ---- (b3) FIX 2: desmarcar todos os dias -> business_hours: null (nao mapa vazio) ----

  it('desmarcar todos os dias e salvar chama update com business_hours: null', async () => {
    const update = vi.fn().mockResolvedValue({ ok: true });
    // Projecao com um dia aberto (segunda), para termos algo para desmarcar.
    mockUseTenantSettings.mockReturnValue(
      makeHook({
        update,
        settings: makeProjection({
          horario: {
            business_hours: {
              tz: 'America/Sao_Paulo',
              days: { '1': { open: '09:00', close: '18:00' } },
            },
          } as never,
        }),
      }),
    );
    render(<ConfiguracoesManager />);

    // Segunda (dow 1) esta aberta -> desmarca.
    const linhaSegunda = screen.getByTestId('dia-1');
    const toggleSegunda = within(linhaSegunda).getByRole('checkbox', { name: /aberto/i });
    fireEvent.click(toggleSegunda);

    fireEvent.click(screen.getByRole('button', { name: /Salvar horário/i }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    const arg = update.mock.calls[0][0];
    expect(arg).toHaveProperty('horario');
    // Nenhum dia aberto -> null (limpar), NAO um mapa vazio.
    expect(arg.horario.business_hours).toBeNull();
  });

  it('sem nenhum dia aberto mostra aviso de loja sem horario', () => {
    mockUseTenantSettings.mockReturnValue(
      makeHook({
        settings: makeProjection({
          horario: { business_hours: null } as never,
          status: { hasBusinessHours: true } as never,
        }),
      }),
    );
    render(<ConfiguracoesManager />);
    // Aviso coerente com o bot: sem horario -> retirada nao oferecida.
    expect(screen.getByText(/retirada não será oferecida/i)).toBeInTheDocument();
  });

  // ---- (c) HORARIO POR-DIA: sabado presente, domingo ausente ----

  it('horario por-dia: sabado 09:00-13:00 aberto + domingo fechado -> mapa com "6" e sem "0"', async () => {
    const update = vi.fn().mockResolvedValue({ ok: true });
    mockUseTenantSettings.mockReturnValue(makeHook({ update }));
    render(<ConfiguracoesManager />);

    // A linha de sabado (dow 6). O toggle "Aberto/Fechado" e os campos de hora
    // sao rotulados por dia via data-testid da linha.
    const linhaSabado = screen.getByTestId('dia-6');
    // Marca sabado como Aberto
    const toggleSabado = within(linhaSabado).getByRole('checkbox', { name: /aberto/i });
    fireEvent.click(toggleSabado);

    // Define abre/fecha do sabado
    const abreSabado = within(linhaSabado).getByLabelText(/abre/i);
    const fechaSabado = within(linhaSabado).getByLabelText(/fecha/i);
    fireEvent.change(abreSabado, { target: { value: '09:00' } });
    fireEvent.change(fechaSabado, { target: { value: '13:00' } });

    // Domingo (dow 0) permanece Fechado (nao marcamos).

    // Salvar a secao Horario
    fireEvent.click(screen.getByRole('button', { name: /Salvar horário/i }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });

    const arg = update.mock.calls[0][0];
    expect(arg).toHaveProperty('horario');
    const bh = arg.horario.business_hours;
    expect(bh).not.toBeNull();
    // Sabado PRESENTE com a faixa correta.
    expect(bh.days['6']).toEqual({ open: '09:00', close: '13:00' });
    // Domingo AUSENTE do mapa (fechado).
    expect(Object.prototype.hasOwnProperty.call(bh.days, '0')).toBe(false);
    // timezone default.
    expect(bh.tz).toBe('America/Sao_Paulo');
  });

  // ---- (d) SINALIZACAO: sem horario -> aviso ----

  it('sinalizacao: com status.hasBusinessHours=false mostra aviso de horario', () => {
    mockUseTenantSettings.mockReturnValue(
      makeHook({ settings: makeProjection({ status: { hasBusinessHours: false } as never }) }),
    );
    render(<ConfiguracoesManager />);
    expect(screen.getByText(/ainda não tem horário definido/i)).toBeInTheDocument();
  });

  it('sinalizacao: com status.hasPixKey=false mostra aviso de PIX', () => {
    mockUseTenantSettings.mockReturnValue(
      makeHook({
        settings: makeProjection({
          pagamento: { pix_key: null } as never,
          status: { hasBusinessHours: true, hasPixKey: false } as never,
        }),
      }),
    );
    render(<ConfiguracoesManager />);
    expect(screen.getByText(/Chave PIX não configurada/i)).toBeInTheDocument();
    // Sem aviso de horario quando hasBusinessHours=true.
    expect(screen.queryByText(/ainda não tem horário definido/i)).not.toBeInTheDocument();
  });
});
