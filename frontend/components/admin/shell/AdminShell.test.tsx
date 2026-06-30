/**
 * Testes do AdminShell — auth-gate único + provider + layout.
 *
 * Mocks:
 *  - @/hooks/useAuth
 *  - ./AdminDataProvider (AdminDataProvider + useAdminData)
 *  - ./AdminNav
 *  - next/link
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminShell } from './AdminShell';

// ---- Mocks ----

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./AdminDataProvider', () => ({
  AdminDataProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-data-provider">{children}</div>
  ),
  useAdminData: vi.fn().mockReturnValue({
    pedidosCount: 0,
    attentionCount: undefined,
    orders: [],
    ordersLoading: false,
    ordersError: null,
  }),
}));

vi.mock('./AdminNav', () => ({
  AdminNav: () => <nav data-testid="admin-nav">Nav</nav>,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { useAuth } from '@/hooks/useAuth';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// ---- Testes ----

describe('AdminShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exibe mensagem de carregamento quando isLoading=true', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    render(<AdminShell><div>conteúdo</div></AdminShell>);
    expect(screen.getByText(/Verificando seu acesso/i)).toBeInTheDocument();
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('exibe link "Entrar" quando não autenticado', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    render(<AdminShell><div>conteúdo</div></AdminShell>);
    const link = screen.getByRole('link', { name: /Entrar/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/login?redirect=/admin');
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('renderiza children dentro do provider quando autenticado', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    render(<AdminShell><div data-testid="page-content">Página</div></AdminShell>);
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(screen.getByTestId('admin-data-provider')).toBeInTheDocument();
    expect(screen.getByTestId('admin-nav')).toBeInTheDocument();
  });

  it('não mostra mensagem de acesso quando autenticado', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    render(<AdminShell><div>conteúdo</div></AdminShell>);
    expect(screen.queryByText(/Verificando seu acesso/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Entrar/i })).not.toBeInTheDocument();
  });
});
