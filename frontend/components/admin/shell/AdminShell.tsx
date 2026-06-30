'use client';

/**
 * AdminShell — moldura única do painel admin.
 *
 * Responsabilidades:
 * 1. Auth-gate ÚNICO (verbatim do padrão de OrdersManager):
 *    isLoading → "Verificando seu acesso…"
 *    !isAuthenticated → mensagem + link para /login
 * 2. Só após o gate: envolve em AdminDataProvider (busca dados apenas autenticado)
 * 3. Layout responsivo: sidebar desktop (240px) + conteúdo; mobile: conteúdo + pb-[72px] para
 *    não sobrepor a barra de abas inferior.
 */

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { AdminDataProvider } from './AdminDataProvider';
import { AdminNav } from './AdminNav';

// Reutiliza o mesmo padrão de CenteredMessage do OrdersManager
function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f3ee] p-8 text-center text-[14px] text-[#1a1814]/65">
      {children}
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // ---- Auth-gate único (verbatim do padrão OrdersManager) ----
  if (isLoading) {
    return <CenteredMessage>Verificando seu acesso…</CenteredMessage>;
  }

  if (!isAuthenticated) {
    return (
      <CenteredMessage>
        <p className="mb-4 text-[16px] font-medium text-[#1a1814]">
          Você precisa entrar para acessar o painel.
        </p>
        <Link
          href="/login?redirect=/admin"
          className="inline-flex h-11 items-center rounded-full bg-[#1a1814] px-6 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
        >
          Entrar
        </Link>
      </CenteredMessage>
    );
  }

  // ---- Autenticado: provider + layout responsivo ----
  return (
    <AdminDataProvider>
      {/* Desktop: grid sidebar + conteúdo */}
      <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814] lg:flex">
        <AdminNav />

        {/* Conteúdo principal
            Desktop: margem esquerda igual à sidebar (240px)
            Mobile: padding-bottom para não sobrepor a bottom-tab bar (72px) */}
        <main className="flex-1 lg:ml-[240px] pb-[72px] lg:pb-0">
          {children}
        </main>
      </div>
    </AdminDataProvider>
  );
}
