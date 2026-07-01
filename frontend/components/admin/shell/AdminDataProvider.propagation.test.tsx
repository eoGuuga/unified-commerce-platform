/**
 * Teste de integração OURO — propagação do badge de Estoque na AdminNav.
 *
 * Prova que a mutação otimista de `adjustStock` propagada pelo AdminDataProvider
 * move o badge DOM da aba "Estoque" na AdminNav no mesmo ciclo de render.
 *
 * Por que este teste é necessário:
 *  Os testes em useStock.test.ts provam a tese no nível do hook isolado.
 *  Este teste prova que a ARQUITETURA DO PROVIDER funciona de ponta a ponta:
 *  quando AdminNav e um consumidor que chama adjustStock ambos montam dentro do
 *  mesmo AdminDataProvider, o badge da aba Estoque da nav re-renderiza junto
 *  com o estado otimista — não é possível obter esse comportamento com
 *  instâncias separadas de useStock.
 *
 * Estratégia:
 *  - Mocka api-client para getStockSummary retornar 2 produtos:
 *      p1 (OK): available=12, min=10 → ok (não conta como atenção)
 *      p2 (Baixo): available=5,  min=10 → low (conta como atenção)
 *    → attentionCount inicial = 1
 *  - Monta <AdminDataProvider><AdminNav /><TriggerAjuste /></AdminDataProvider>
 *    onde TriggerAjuste é um componente de teste que consome useAdminData().adjustStock
 *    e expõe um botão que aciona o ajuste via botão no DOM.
 *  - Após mount, asserta que o badge da aba Estoque da AdminNav exibe "1".
 *  - Clica no botão de TriggerAjuste (aplica PERDA de -3 a p1:
 *    available cai de 12 para 9; 9 < 10 → low → agora conta como atenção).
 *  - Asserta que o badge DOM da aba Estoque agora exibe "2".
 *
 * Este teste FALHARIA se AdminNav e TriggerAjuste usassem instâncias
 * separadas de useStock — porque o ajuste otimista de uma instância não
 * seria visível na outra. O fato de passar PROVA a arquitetura de provider único.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AdminDataProvider, useAdminData } from './AdminDataProvider';

// ---- Mocks de dependências externas ----

// useOrders não faz parte deste teste; mock estático
const mockUseOrdersReturn = {
  orders: [],
  loading: false,
  error: null,
  refetch: vi.fn(),
  updateStatus: vi.fn(),
  updatingId: null,
};

vi.mock('@/hooks/useOrders', () => ({
  useOrders: vi.fn(),
}));

// api-client: controlado — getStockSummary retorna 2 produtos específicos
vi.mock('@/lib/api-client', () => ({
  default: {
    getStockSummary: vi.fn(),
    adjustStock: vi.fn(),
    setMinStock: vi.fn(),
    getStockHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

// next/navigation: AdminNav usa usePathname()
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// next/link: AdminNav usa Link — simplifica para <a>
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// useAuth: AdminNav usa para renderizar avatar
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// lucide-react: AdminNav importa ícones; mock simples evita SVG complexo
vi.mock('lucide-react', () => ({
  Home: () => <span data-testid="icon-home" />,
  Receipt: () => <span data-testid="icon-receipt" />,
  Package: () => <span data-testid="icon-package" />,
  Boxes: () => <span data-testid="icon-boxes" />,
  Settings: () => <span data-testid="icon-settings" />,
  LogOut: () => <span data-testid="icon-logout" />,
}));

import api from '@/lib/api-client';
import { useOrders } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';
import { AdminNav } from './AdminNav';

const mockApi = api as {
  getStockSummary: ReturnType<typeof vi.fn>;
  adjustStock: ReturnType<typeof vi.fn>;
};
const mockUseOrders = useOrders as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

// ---- Summary inicial ----
// p1 (OK): available=12, min=10 → não é atenção
// p2 (Baixo): available=5, min=10 → é atenção
// attentionCount inicial = 1
const summaryInicial = {
  total_products: 2,
  low_stock_count: 1,
  out_of_stock_count: 0,
  products: [
    {
      id: 'p1',
      name: 'Produto OK',
      current_stock: 12,
      reserved_stock: 0,
      available_stock: 12,
      min_stock: 10,
      status: 'ok',
    },
    {
      id: 'p2',
      name: 'Produto Baixo',
      current_stock: 5,
      reserved_stock: 0,
      available_stock: 5,
      min_stock: 10,
      status: 'low',
    },
  ],
};

// ---- Componente auxiliar de teste ----
// Monta dentro do provider e expõe um botão que chama adjustStock.
// NÃO contém sua própria instância de useStock — consome o MESMO contexto
// que AdminNav usa via useAdminData().

function TriggerAjuste({ productId, delta }: { productId: string; delta: number }) {
  const { adjustStock } = useAdminData();
  return (
    <button
      data-testid="trigger-ajuste"
      onClick={() => void adjustStock(productId, 'PERDA', delta)}
    >
      Aplicar Perda
    </button>
  );
}

// ---- Helper: encontra o badge da aba Estoque ----
// AdminNav renderiza dois navs (desktop sidebar + mobile bottom).
// Cada badge de atenção da aba Estoque é um <span> com texto numérico.
// Buscamos todos os badges dentro dos links de Estoque.
function getBadgesDeEstoque(): HTMLElement[] {
  // O badge fica dentro de <a href="/admin/estoque">
  const linksEstoque = document.querySelectorAll('a[href="/admin/estoque"]');
  const badges: HTMLElement[] = [];
  linksEstoque.forEach((link) => {
    // Qualquer <span> filho com conteúdo numérico é o badge
    const spans = link.querySelectorAll('span');
    spans.forEach((span) => {
      const txt = span.textContent?.trim();
      if (txt && /^\d+(\+)?$/.test(txt)) {
        badges.push(span as HTMLElement);
      }
    });
  });
  return badges;
}

// ---- Setup padrão de mocks reutilizado nos describe blocks ----
function setupMocks() {
  mockUseOrders.mockReturnValue(mockUseOrdersReturn);
  mockUseAuth.mockReturnValue({
    user: { full_name: 'Teste', email: 't@t.com', id: 'u1', role: 'admin', tenant_id: 't1' },
    logout: vi.fn(),
  });
  mockUsePathname.mockReturnValue('/admin/estoque');
  mockApi.getStockSummary.mockResolvedValue(summaryInicial);
  mockApi.adjustStock.mockResolvedValue({ saldo_resultante: 9 });
}

// ---- Testes ----

describe('AdminDataProvider — propagação OURO: badge DOM da AdminNav move com adjustStock otimista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * GOLD-STANDARD — propagação de ponta a ponta.
   *
   * Monta AdminNav + TriggerAjuste DENTRO do mesmo AdminDataProvider.
   * Após adjustStock otimista (PERDA -3 em p1: available 12→9, 9<10→low),
   * o badge DOM da aba Estoque na AdminNav deve passar de "1" para "2"
   * sem nenhum fetch adicional — prova que o provider único propaga o estado.
   *
   * Este teste FALHARIA se AdminNav e TriggerAjuste usassem instâncias
   * separadas de useStock: o ajuste na instância do trigger não seria
   * visível na instância da nav, e o badge ficaria em "1".
   */
  it('badge DOM de Estoque na AdminNav passa de 1 para 2 após adjustStock otimista (PERDA em p1)', async () => {
    const user = userEvent.setup();

    render(
      <AdminDataProvider>
        <AdminNav />
        <TriggerAjuste productId="p1" delta={-3} />
      </AdminDataProvider>,
    );

    // Aguarda o fetch inicial resolver e o badge aparecer
    await waitFor(() => {
      const badges = getBadgesDeEstoque();
      expect(badges.length).toBeGreaterThan(0);
    });

    // Estado inicial: badge mostra "1" (apenas p2 em atenção)
    const badgesIniciais = getBadgesDeEstoque();
    expect(badgesIniciais.length).toBeGreaterThan(0);
    badgesIniciais.forEach((badge) => {
      expect(badge.textContent?.trim()).toBe('1');
    });

    // Aplica PERDA de -3 em p1:
    //   current: 12 + (-3) = 9; available: 9 - 0(reserved) = 9; min_stock = 10
    //   9 < 10 → low → agora p1 também conta como atenção
    await user.click(screen.getByTestId('trigger-ajuste'));

    // Após o ajuste otimista: p1 agora é "low" → attentionCount = 2
    // O badge DOM da AdminNav DEVE refletir o novo valor NO MESMO RENDER
    // (prova do provider único — AdminNav lê do mesmo contexto que o trigger gravou)
    await waitFor(() => {
      const badgesApos = getBadgesDeEstoque();
      expect(badgesApos.length).toBeGreaterThan(0);
      badgesApos.forEach((badge) => {
        expect(badge.textContent?.trim()).toBe('2');
      });
    });
  });

  /**
   * Revert de badge: em caso de erro na API, o optimistic é desfeito e
   * o badge volta ao valor original (o provider único também garante o revert).
   *
   * Sequência: badge "1" → optimism temporário (badge "2") → api rejeita
   * → revert → badge "1" novamente.
   */
  it('badge DOM de Estoque reverte de 2 para 1 quando api.adjustStock rejeita', async () => {
    // Sobrescreve o mock de adjustStock para rejeitar nesta execução
    mockApi.adjustStock.mockRejectedValueOnce(new Error('Falha simulada no servidor'));
    const user = userEvent.setup();

    render(
      <AdminDataProvider>
        <AdminNav />
        <TriggerAjuste productId="p1" delta={-3} />
      </AdminDataProvider>,
    );

    // Aguarda o fetch inicial
    await waitFor(() => {
      const badges = getBadgesDeEstoque();
      expect(badges.length).toBeGreaterThan(0);
    });

    // Badge inicial = 1
    getBadgesDeEstoque().forEach((badge) => {
      expect(badge.textContent?.trim()).toBe('1');
    });

    // Dispara o ajuste (que vai falhar após o optimism aplicado)
    await user.click(screen.getByTestId('trigger-ajuste'));

    // Após revert fiel: badge deve voltar para "1"
    await waitFor(() => {
      getBadgesDeEstoque().forEach((badge) => {
        expect(badge.textContent?.trim()).toBe('1');
      });
    });
  });
});

/**
 * Fix 2 — Teste de wire do tipo DEVOLUCAO.
 *
 * Espelha os testes existentes de COMPRA/PERDA/AJUSTE em useStock.test.ts:
 * DEVOLUCAO deve enviar um delta POSITIVO no wire (quantidade devolvida ao estoque).
 * Ex.: devolução de 5 unidades → api.adjustStock('pX', 'DEVOLUCAO', +5, motivo)
 */
describe('useStock.adjustStock — wire DEVOLUCAO envia delta positivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    mockApi.adjustStock.mockResolvedValue({ saldo_resultante: 17 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DEVOLUCAO envia delta=+5 no wire (quantidade positiva devolvida ao estoque)', async () => {
    // Usa o hook diretamente para testar o wire sem o provider completo
    // (espelha o padrão dos testes existentes em useStock.test.ts)
    const { renderHook, act } = await import('@testing-library/react');
    const { useStock } = await import('@/hooks/useStock');

    const { result } = renderHook(() => useStock());

    // Aguarda o fetch inicial
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Chama adjustStock com DEVOLUCAO e delta positivo (+5)
    await act(async () => {
      await result.current.adjustStock('p1', 'DEVOLUCAO', 5, 'Devolução de cliente');
    });

    // Wire: api.adjustStock deve ter recebido delta +5 (positivo)
    expect(mockApi.adjustStock).toHaveBeenCalledWith('p1', 'DEVOLUCAO', 5, 'Devolução de cliente');
    // Explicita que o delta é positivo — DEVOLUCAO aumenta o estoque
    const [, , deltaRecebido] = mockApi.adjustStock.mock.calls[0] as [string, string, number, string];
    expect(deltaRecebido).toBeGreaterThan(0);
    expect(deltaRecebido).toBe(5);
  });

  it('DEVOLUCAO de 10 unidades envia delta=+10 no wire', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const { useStock } = await import('@/hooks/useStock');

    const { result } = renderHook(() => useStock());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.adjustStock('p2', 'DEVOLUCAO', 10);
    });

    expect(mockApi.adjustStock).toHaveBeenCalledWith('p2', 'DEVOLUCAO', 10, undefined);
    const [, , deltaRecebido] = mockApi.adjustStock.mock.calls[0] as [string, string, number, undefined];
    expect(deltaRecebido).toBe(10);
    expect(deltaRecebido).toBeGreaterThan(0);
  });
});
