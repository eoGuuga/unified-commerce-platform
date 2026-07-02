import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// Single-tenant: TENANT_ID != sentinel → o seletor de workspace fica recolhido.
vi.mock('@/lib/config', () => ({
  API_BASE_URL: 'https://api.test/api/v1',
  TENANT_ID: 'loja-real-uuid-1234',
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ login: vi.fn(), isAuthenticated: false, isLoading: false }),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import LoginExperience from './LoginExperience';

describe('LoginExperience — voz (D2/K2): sem jargão técnico', () => {
  function renderLogin() {
    render(<LoginExperience redirectTarget="/admin" />);
  }

  it('não mostra o seletor/campo de workspace no single-tenant', () => {
    renderLogin();
    expect(screen.queryByText(/informar workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^workspace$/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/uuid do workspace/i)).not.toBeInTheDocument();
  });

  it('não usa jargão técnico (bot, end-to-end, ecossistema, ambiente, UUID)', () => {
    const { container } = render(<LoginExperience redirectTarget="/admin" />);
    const texto = container.textContent ?? '';
    expect(texto).not.toMatch(/\bbot\b/i);
    expect(texto).not.toMatch(/end-to-end/i);
    expect(texto).not.toMatch(/ecossistema/i);
    expect(texto).not.toMatch(/ambiente/i);
    expect(texto).not.toMatch(/workspace/i);
  });

  it('usa a copy simples e acolhedora aprovada', () => {
    renderLogin();
    expect(screen.getByText(/entre com seu e-mail e senha/i)).toBeInTheDocument();
    expect(screen.getByText(/seus dados protegidos com segurança/i)).toBeInTheDocument();
  });
});
