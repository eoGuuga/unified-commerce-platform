'use client';

import { Boxes, LogOut, RefreshCw, Sparkles, Store } from 'lucide-react';

interface AdminHeaderProps {
  showOnboarding: boolean;
  onToggleOnboarding: () => void;
  onRefresh: () => void;
  onOpenStock: () => void;
  onLogout: () => void;
}

export function AdminHeader({
  showOnboarding,
  onToggleOnboarding,
  onRefresh,
  onOpenStock,
  onLogout,
}: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-35px_rgba(16,185,129,0.9)]">
            <Store className="size-5 text-accent" />
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
              command center
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Dashboard Admin
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
          >
            <RefreshCw className="size-4" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={onOpenStock}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
          >
            <Boxes className="size-4" />
            Estoque
          </button>
          <button
            type="button"
            onClick={onToggleOnboarding}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
          >
            <Sparkles className="size-4" />
            {showOnboarding ? 'Ocultar onboarding' : 'Mostrar onboarding'}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
