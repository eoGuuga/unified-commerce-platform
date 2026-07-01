'use client';

/**
 * AdminNav — navegação responsiva do painel admin.
 *
 * Desktop: sidebar lateral fixa w-[240px].
 * Mobile: barra de abas fixada no bottom-0.
 *
 * Selos (badges) são lidos do AdminDataContext — sem props.
 * Item ativo detectado via usePathname().
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Receipt, Package, Boxes, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminData } from './AdminDataProvider';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Chave do badge no contexto — opcional. */
  badgeKey?: 'pedidosCount' | 'attentionCount';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Início', href: '/admin', icon: Home },
  { label: 'Pedidos', href: '/admin/pedidos', icon: Receipt, badgeKey: 'pedidosCount' },
  { label: 'Produtos', href: '/admin/produtos', icon: Package },
  { label: 'Estoque', href: '/admin/estoque', icon: Boxes, badgeKey: 'attentionCount' },
  { label: 'Configurações', href: '/admin/configuracoes', icon: Settings },
];

/** Retorna true se o pathname corresponde ao item de nav (match exato para /admin; prefixo para sub-rotas). */
function isActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}

// ---- Sub-componente: avatar + logout (reutilizado em desktop e mobile) ----

function UserAvatar({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : '?';

  if (compact) {
    // Versão compacta para mobile (topo)
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a1814] text-[11px] font-semibold text-[#f6f3ee]"
          aria-label={user?.full_name ?? 'Usuário'}
        >
          {initials}
        </div>
        <button
          onClick={logout}
          aria-label="Sair"
          className="flex items-center gap-1 text-[12px] font-medium text-[#1a1814]/55 transition hover:text-[#1a1814]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    );
  }

  // Versão completa para desktop (rodapé da sidebar)
  return (
    <div className="flex items-center gap-3 border-t border-[#1a1814]/8 px-5 py-4">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a1814] text-[12px] font-semibold text-[#f6f3ee]"
        aria-label={user?.full_name ?? 'Usuário'}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#1a1814]">{user?.full_name ?? 'Usuário'}</p>
        <p className="truncate text-[11px] text-[#1a1814]/50">{user?.email ?? ''}</p>
      </div>
      <button
        onClick={logout}
        aria-label="Sair"
        className="shrink-0 text-[#1a1814]/40 transition hover:text-[#1a1814]"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---- Sub-componente: badge de contagem ----

function Badge({ count }: { count: number | undefined }) {
  if (!count || count <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b8654a] px-1.5 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ---- Componente principal ----

export function AdminNav() {
  const pathname = usePathname();
  const { pedidosCount, attentionCount } = useAdminData();

  function getBadgeCount(key?: 'pedidosCount' | 'attentionCount'): number | undefined {
    if (!key) return undefined;
    if (key === 'pedidosCount') return pedidosCount;
    if (key === 'attentionCount') return attentionCount;
    return undefined;
  }

  // ---- Desktop: sidebar fixa lateral ----
  const desktopNav = (
    <nav
      aria-label="Navegação do admin"
      className="hidden lg:flex fixed left-0 top-0 h-screen w-[240px] flex-col bg-[#f6f3ee] border-r border-[#1a1814]/8 z-40"
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-[#1a1814]/8 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#1a1814] text-[10px] font-semibold text-[#f6f3ee]">
          GT
        </div>
        <span
          className="text-[15px] font-medium tracking-[-0.01em] text-[#1a1814]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          GTSoftHub
        </span>
      </div>

      {/* Itens de nav */}
      <div className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          const count = getBadgeCount(item.badgeKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 mx-2 rounded-[6px] px-3 py-2.5 text-[14px] font-medium transition-colors ${
                active
                  ? 'bg-[#b8654a]/10 text-[#b8654a]'
                  : 'text-[#1a1814]/70 hover:bg-[#1a1814]/5 hover:text-[#1a1814]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
              <span className="flex-1">{item.label}</span>
              <Badge count={count} />
            </Link>
          );
        })}
      </div>

      {/* Avatar no rodapé */}
      <UserAvatar />
    </nav>
  );

  // ---- Mobile: barra de abas fixada na parte inferior ----
  const mobileNav = (
    <nav
      aria-label="Navegação do admin"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex h-[72px] items-stretch border-t border-[#1a1814]/8 bg-[#f6f3ee]"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname);
        const count = getBadgeCount(item.badgeKey);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              active ? 'text-[#b8654a]' : 'text-[#1a1814]/50 hover:text-[#1a1814]'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <div className="relative">
              <item.icon className="h-5 w-5" strokeWidth={1.6} />
              {count != null && count > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b8654a] px-1 text-[9px] font-bold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {desktopNav}
      {mobileNav}
    </>
  );
}
