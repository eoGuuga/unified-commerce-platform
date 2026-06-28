/**
 * Testes do AdminNav — sidebar desktop / bottom-tab mobile.
 *
 * Mocks:
 *  - next/navigation (usePathname)
 *  - @/hooks/useAuth
 *  - ./AdminDataProvider (useAdminData)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminNav } from './AdminNav';

// ---- Mocks ----

vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/admin'),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { full_name: 'Gustavo', email: 'g@g.com', id: 'u1', role: 'admin', tenant_id: 't1' },
    logout: vi.fn(),
  }),
}));

vi.mock('./AdminDataProvider', () => ({
  useAdminData: vi.fn().mockReturnValue({
    pedidosCount: 0,
    attentionCount: undefined,
  }),
}));

import { usePathname } from 'next/navigation';
import { useAdminData } from './AdminDataProvider';

const mockPathname = usePathname as ReturnType<typeof vi.fn>;
const mockUseAdminData = useAdminData as ReturnType<typeof vi.fn>;

// ---- Helpers ----

function setup(pathname: string, pedidosCount = 0, attentionCount: number | undefined = undefined) {
  mockPathname.mockReturnValue(pathname);
  mockUseAdminData.mockReturnValue({ pedidosCount, attentionCount });
  return render(<AdminNav />);
}

// ---- Testes ----

describe('AdminNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza as 4 abas de navegação', () => {
    setup('/admin');
    // Cada aba aparece duas vezes (desktop sidebar + mobile bottom bar)
    expect(screen.getAllByText('Início').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pedidos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Produtos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Estoque').length).toBeGreaterThanOrEqual(1);
  });

  it('oculta badge de pedidos quando pedidosCount é 0', () => {
    setup('/admin', 0);
    // Nenhum elemento com "0" como badge deve aparecer (badge some quando count<=0)
    const badges = screen.queryAllByText('0');
    // Badges de contagem não devem aparecer — verificamos que não há <span> com "0"
    // isolado em um badge (a checagem real é via ausência de aria-label de badge)
    expect(badges.filter((el) => el.tagName === 'SPAN' && el.className.includes('rounded-full') && el.textContent === '0')).toHaveLength(0);
  });

  it('oculta badge de pedidos quando pedidosCount é undefined', () => {
    setup('/admin', undefined as unknown as number);
    const badges = document.querySelectorAll('.bg-\\[\\#b8654a\\]');
    expect(badges).toHaveLength(0);
  });

  it('exibe badge de pedidos quando pedidosCount > 0', () => {
    setup('/admin', 3);
    // Badge deve aparecer com o valor "3"
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('oculta badge de estoque quando attentionCount é undefined', () => {
    setup('/admin/estoque', 0, undefined);
    // Não deve mostrar nenhum badge de atenção
    const badges = document.querySelectorAll('.bg-\\[\\#b8654a\\]');
    expect(badges).toHaveLength(0);
  });

  it('exibe badge de estoque quando attentionCount > 0', () => {
    setup('/admin/estoque', 0, 5);
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
  });

  it('marca /admin como ativo na rota /admin', () => {
    setup('/admin');
    // Links com aria-current="page" indicam item ativo
    const activeLinks = document.querySelectorAll('a[aria-current="page"]');
    // Deve haver ao menos 1 link ativo (desktop + mobile = 2)
    expect(activeLinks.length).toBeGreaterThanOrEqual(1);
    // O primeiro deve ser o link de Início
    expect(activeLinks[0].getAttribute('href')).toBe('/admin');
  });

  it('marca /admin/pedidos como ativo na rota /admin/pedidos', () => {
    setup('/admin/pedidos');
    const activeLinks = document.querySelectorAll('a[aria-current="page"]');
    expect(activeLinks.length).toBeGreaterThanOrEqual(1);
    expect(activeLinks[0].getAttribute('href')).toBe('/admin/pedidos');
  });

  it('não marca /admin como ativo na rota /admin/pedidos', () => {
    setup('/admin/pedidos');
    // Links de Início não devem ser ativos
    const allLinks = document.querySelectorAll('a[href="/admin"]');
    allLinks.forEach((link) => {
      expect(link.getAttribute('aria-current')).toBeNull();
    });
  });

  it('exibe botão Sair', () => {
    setup('/admin');
    expect(screen.getAllByLabelText('Sair').length).toBeGreaterThanOrEqual(1);
  });
});
