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

// ---- Mock dos hooks de dados (T6) ----

vi.mock('@/hooks/useTenantSettings', () => ({
  useTenantSettings: vi.fn(),
}));

vi.mock('@/hooks/useAvailabilityExceptions', () => ({
  useAvailabilityExceptions: vi.fn(),
}));

import { useTenantSettings } from '@/hooks/useTenantSettings';
import { useAvailabilityExceptions } from '@/hooks/useAvailabilityExceptions';
import { ConfiguracoesManager } from './ConfiguracoesManager';
import type { TenantSettingsProjection } from '@/lib/types/tenant-settings';
import type { StoreException } from '@/lib/types/store-exception';

const mockUseTenantSettings = useTenantSettings as ReturnType<typeof vi.fn>;
const mockUseAvailabilityExceptions =
  useAvailabilityExceptions as ReturnType<typeof vi.fn>;

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

function makeExc(overrides: Partial<StoreException> = {}): StoreException {
  return {
    id: 'exc-1',
    date: '2026-12-25',
    kind: 'closed',
    open: null,
    close: null,
    ...overrides,
  };
}

function makeExcHook(overrides: Record<string, unknown> = {}) {
  return {
    exceptions: [] as StoreException[],
    loading: false,
    error: null,
    add: vi.fn().mockResolvedValue({ ok: true }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
    closeToday: vi.fn().mockResolvedValue({ ok: true }),
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ConfiguracoesManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: hook das exceções sempre com um valor válido (as sub-suítes que
    // precisam de dados específicos sobrescrevem via mockReturnValue).
    mockUseAvailabilityExceptions.mockReturnValue(makeExcHook());
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
    // Aviso (voz do lojista): sem horario -> clientes nao podem agendar retirada.
    expect(
      screen.getByText(/seus clientes não poderão agendar retirada/i),
    ).toBeInTheDocument();
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

  // ---- (T7) Secao "Exceções / Feriados" ----

  describe('seção Exceções / Feriados', () => {
    // (a) renderiza a seção com a lista das exceções futuras (mockadas).
    it('renderiza a seção com a lista das exceções futuras', () => {
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(
        makeExcHook({
          exceptions: [
            makeExc({ id: 'a', date: '2026-12-25', kind: 'closed' }),
            makeExc({
              id: 'b',
              date: '2026-12-31',
              kind: 'custom_hours',
              open: '09:00',
              close: '13:00',
            }),
          ],
        }),
      );
      render(<ConfiguracoesManager />);

      // Titulo da 4a secao (h2).
      expect(
        screen.getByRole('heading', { level: 2, name: /Exceções/i }),
      ).toBeInTheDocument();

      // Linhas da lista (escopo p/ nao colidir com o radio "Fechado" do form).
      const lista = screen.getByTestId('excecoes-lista');
      expect(within(lista).getByText(/Fechado/i)).toBeInTheDocument();
      expect(within(lista).getByText(/09:00/)).toBeInTheDocument();
      expect(within(lista).getByText(/13:00/)).toBeInTheDocument();
    });

    // (b) adicionar exceção Fechado numa data -> add({ date, kind:'closed' }) (sem open/close).
    it('adicionar exceção Fechado chama add({ date, kind: "closed" })', async () => {
      const add = vi.fn().mockResolvedValue({ ok: true });
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(makeExcHook({ add }));
      render(<ConfiguracoesManager />);

      const secao = screen.getByTestId('secao-excecoes');
      // Data.
      fireEvent.change(within(secao).getByLabelText(/Data da exceção/i), {
        target: { value: '2026-12-25' },
      });
      // Tipo "Fechado" (default), garante selecionado.
      fireEvent.click(within(secao).getByLabelText(/^Fechado$/i));
      // Adicionar.
      fireEvent.click(within(secao).getByRole('button', { name: /Adicionar/i }));

      await waitFor(() => {
        expect(add).toHaveBeenCalledTimes(1);
      });
      const arg = add.mock.calls[0][0];
      expect(arg).toEqual({ date: '2026-12-25', kind: 'closed' });
      // Sem open/close num closed.
      expect(Object.prototype.hasOwnProperty.call(arg, 'open')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(arg, 'close')).toBe(false);
    });

    // (c) adicionar Horario especial 09:00-13:00 -> add({ date, kind:'custom_hours', open, close }).
    it('adicionar Horário especial chama add com kind custom_hours + open/close', async () => {
      const add = vi.fn().mockResolvedValue({ ok: true });
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(makeExcHook({ add }));
      render(<ConfiguracoesManager />);

      const secao = screen.getByTestId('secao-excecoes');
      fireEvent.change(within(secao).getByLabelText(/Data da exceção/i), {
        target: { value: '2026-12-31' },
      });
      // Seleciona "Horário especial".
      fireEvent.click(within(secao).getByLabelText(/Horário especial/i));
      // Abre/fecha só aparecem no modo especial.
      fireEvent.change(within(secao).getByLabelText(/^Abre$/i), {
        target: { value: '09:00' },
      });
      fireEvent.change(within(secao).getByLabelText(/^Fecha$/i), {
        target: { value: '13:00' },
      });
      fireEvent.click(within(secao).getByRole('button', { name: /Adicionar/i }));

      await waitFor(() => {
        expect(add).toHaveBeenCalledTimes(1);
      });
      expect(add.mock.calls[0][0]).toEqual({
        date: '2026-12-31',
        kind: 'custom_hours',
        open: '09:00',
        close: '13:00',
      });
    });

    // (d) clicar "Remover" numa linha -> remove(id).
    it('clicar Remover numa linha chama remove(id)', async () => {
      const remove = vi.fn().mockResolvedValue({ ok: true });
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(
        makeExcHook({
          remove,
          exceptions: [makeExc({ id: 'exc-42', date: '2026-12-25', kind: 'closed' })],
        }),
      );
      render(<ConfiguracoesManager />);

      const secao = screen.getByTestId('secao-excecoes');
      fireEvent.click(within(secao).getByRole('button', { name: /Remover/i }));

      await waitFor(() => {
        expect(remove).toHaveBeenCalledTimes(1);
      });
      expect(remove).toHaveBeenCalledWith('exc-42');
    });

    // (e) "Fechar hoje" -> closeToday().
    it('clicar Fechar hoje chama closeToday()', async () => {
      const closeToday = vi.fn().mockResolvedValue({ ok: true });
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(makeExcHook({ closeToday }));
      render(<ConfiguracoesManager />);

      const secao = screen.getByTestId('secao-excecoes');
      fireEvent.click(within(secao).getByRole('button', { name: /Fechar hoje/i }));

      await waitFor(() => {
        expect(closeToday).toHaveBeenCalledTimes(1);
      });
    });

    // Estado vazio: sem exceções, mostra mensagem.
    it('sem exceções mostra estado vazio', () => {
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(makeExcHook({ exceptions: [] }));
      render(<ConfiguracoesManager />);

      const secao = screen.getByTestId('secao-excecoes');
      expect(
        within(secao).getByText(/Nenhuma exceção/i),
      ).toBeInTheDocument();
    });
  });

  // ---- Bloco 1 (polimento) — K3: validação open < close ----

  describe('K3: validação open < close (janela degenerada/invertida)', () => {
    it('dias: abertura >= fechamento (18:00 até 09:00) mostra aviso e desabilita "Salvar horário"', () => {
      mockUseTenantSettings.mockReturnValue(makeHook());
      render(<ConfiguracoesManager />);

      const linha = screen.getByTestId('dia-6');
      fireEvent.click(within(linha).getByRole('checkbox', { name: /aberto/i }));
      fireEvent.change(within(linha).getByLabelText(/abre/i), { target: { value: '18:00' } });
      fireEvent.change(within(linha).getByLabelText(/fecha/i), { target: { value: '09:00' } });

      expect(within(linha).getByText(/antes do fechamento/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Salvar horário/i })).toBeDisabled();
    });

    it('dias: janela degenerada (02:11 até 02:11) também bloqueia', () => {
      mockUseTenantSettings.mockReturnValue(makeHook());
      render(<ConfiguracoesManager />);

      const linha = screen.getByTestId('dia-6');
      fireEvent.click(within(linha).getByRole('checkbox', { name: /aberto/i }));
      fireEvent.change(within(linha).getByLabelText(/abre/i), { target: { value: '02:11' } });
      fireEvent.change(within(linha).getByLabelText(/fecha/i), { target: { value: '02:11' } });

      expect(within(linha).getByText(/antes do fechamento/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Salvar horário/i })).toBeDisabled();
    });

    it('dias: horário válido (09:00 até 13:00) mantém "Salvar horário" habilitado', () => {
      mockUseTenantSettings.mockReturnValue(makeHook());
      render(<ConfiguracoesManager />);

      const linha = screen.getByTestId('dia-6');
      fireEvent.click(within(linha).getByRole('checkbox', { name: /aberto/i }));
      fireEvent.change(within(linha).getByLabelText(/abre/i), { target: { value: '09:00' } });
      fireEvent.change(within(linha).getByLabelText(/fecha/i), { target: { value: '13:00' } });

      expect(within(linha).queryByText(/antes do fechamento/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Salvar horário/i })).not.toBeDisabled();
    });

    it('exceção: horário especial com abertura >= fechamento mostra aviso e desabilita "Adicionar"', () => {
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(makeExcHook());
      render(<ConfiguracoesManager />);

      const secao = screen.getByTestId('secao-excecoes');
      fireEvent.change(within(secao).getByLabelText(/Data da exceção/i), {
        target: { value: '2026-12-31' },
      });
      fireEvent.click(within(secao).getByLabelText(/Horário especial/i));
      fireEvent.change(within(secao).getByLabelText(/^Abre$/i), { target: { value: '18:00' } });
      fireEvent.change(within(secao).getByLabelText(/^Fecha$/i), { target: { value: '09:00' } });

      expect(within(secao).getByText(/antes do fechamento/i)).toBeInTheDocument();
      expect(within(secao).getByRole('button', { name: /Adicionar/i })).toBeDisabled();
    });
  });

  // ---- Bloco 2 (polimento) — A5: tipo reseta apos adicionar ----

  describe('A5: tipo da exceção reseta após sucesso', () => {
    it('após adicionar "Horário especial", o tipo volta ao default "Fechado" (não persiste)', async () => {
      const add = vi.fn().mockResolvedValue({ ok: true });
      mockUseTenantSettings.mockReturnValue(makeHook());
      mockUseAvailabilityExceptions.mockReturnValue(makeExcHook({ add }));
      render(<ConfiguracoesManager />);

      const secao = screen.getByTestId('secao-excecoes');
      fireEvent.change(within(secao).getByLabelText(/Data da exceção/i), {
        target: { value: '2026-12-31' },
      });
      fireEvent.click(within(secao).getByLabelText(/Horário especial/i));
      fireEvent.change(within(secao).getByLabelText(/^Abre$/i), { target: { value: '09:00' } });
      fireEvent.change(within(secao).getByLabelText(/^Fecha$/i), { target: { value: '13:00' } });
      fireEvent.click(within(secao).getByRole('button', { name: /Adicionar/i }));

      await waitFor(() => expect(add).toHaveBeenCalledTimes(1));

      // Após o sucesso, o tipo volta a "Fechado" (default) e os campos de horário somem.
      await waitFor(() => {
        expect(
          (within(secao).getByLabelText(/^Fechado$/i) as HTMLInputElement).checked,
        ).toBe(true);
      });
      expect(within(secao).queryByLabelText(/^Abre$/i)).not.toBeInTheDocument();
    });
  });
});
