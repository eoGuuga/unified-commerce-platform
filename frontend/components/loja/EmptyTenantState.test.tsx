import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyTenantState } from './EmptyTenantState';

describe('EmptyTenantState', () => {
  describe('isOperatorPreview=true', () => {
    it('mostra texto tecnico para operador', () => {
      render(<EmptyTenantState isOperatorPreview />);
      expect(
        screen.getByText('configuracao necessaria'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: /tenant configurado para carregar o catalogo/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/NEXT_PUBLIC_TENANT_ID/i),
      ).toBeInTheDocument();
    });
  });

  describe('isOperatorPreview=false', () => {
    it('mostra mensagem amigavel para visitante', () => {
      render(<EmptyTenantState isOperatorPreview={false} />);
      expect(
        screen.getByText('vitrine em preparacao'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: /preparando esta vitrine/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it('inclui as 3 mini-secoes tenant/login/resultado', () => {
    render(<EmptyTenantState isOperatorPreview />);
    expect(screen.getByText('tenant')).toBeInTheDocument();
    expect(screen.getByText('login')).toBeInTheDocument();
    expect(screen.getByText('resultado')).toBeInTheDocument();
  });
});
