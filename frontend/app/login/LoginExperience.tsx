'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { TENANT_ID } from '@/lib/config';

const SENTINEL_TENANT = '00000000-0000-0000-0000-000000000000';
const DEFAULT_WORKSPACE = TENANT_ID === SENTINEL_TENANT ? '' : TENANT_ID;

const trustSignals = [
  { icon: Shield, label: 'Sessao criptografada' },
  { icon: Sparkles, label: 'UX premium em todos os modulos' },
  { icon: ArrowRight, label: 'Acesso direto a operacao' },
];

export default function LoginExperience({ redirectTarget }: { redirectTarget: string }) {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantId, setTenantId] = useState(DEFAULT_WORKSPACE);
  const [showWorkspaceField, setShowWorkspaceField] = useState(Boolean(DEFAULT_WORKSPACE));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect automatico se ja autenticado
  useState(() => {
    if (!isLoading && isAuthenticated) {
      window.location.replace(redirectTarget);
    }
  });

  const isBusy = submitting;

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await login(email.trim(), password, tenantId.trim() || undefined);

    if (!result.success) {
      setError(result.error || 'Nao foi possivel entrar na plataforma.');
      setSubmitting(false);
      return;
    }

    window.location.replace(redirectTarget);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background gradiente sutil */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 mesh-gradient opacity-40" />

      {/* Header minimalista */}
      <header className="relative z-10 border-b border-white/6 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/92 text-xs font-semibold tracking-[0.22em] text-slate-950 shadow-[0_12px_40px_-20px_rgba(255,255,255,0.7)]">
              GT
            </div>
            <p className="text-sm font-semibold tracking-tight text-white">GTSoftHub</p>
          </Link>

          <Link
            href="/"
            className="text-xs uppercase tracking-[0.24em] text-slate-400 transition hover:text-white"
          >
            Voltar
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 px-6 py-8 lg:grid-cols-2 lg:gap-12">
        {/* Lado esquerdo: brand visual */}
        <section className="relative hidden overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,17,20,0.96),rgba(6,8,11,0.98))] p-10 shadow-[0_40px_120px_-48px_rgba(6,182,212,0.55)] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.18),transparent_34%),radial-gradient(circle_at_85%_85%,rgba(34,211,238,0.18),transparent_38%)]" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-accent">
              Plataforma premium para varejo
            </span>
            <h1 className="mt-6 max-w-md text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-4xl xl:text-[3.4rem]">
              Entre na operacao que respira em unissono.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
              Estoque, PDV, loja online e atendimento compartilhando a mesma fonte de verdade. A plataforma que devolve ritmo e serenidade para quem vende.
            </p>
          </div>

          {/* Trust signals visuais */}
          <div className="relative mt-10 space-y-3">
            {trustSignals.map((signal) => (
              <div
                key={signal.label}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
                  <signal.icon className="h-4 w-4 text-accent" />
                </div>
                <p className="text-sm font-medium text-slate-100">{signal.label}</p>
              </div>
            ))}
          </div>

          {/* Mini metric visual */}
          <div className="relative mt-10 rounded-2xl border border-white/8 bg-slate-950/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Operacao sincronizada</p>
                <p className="mt-2 text-lg font-semibold text-white">Loja, PDV e admin no mesmo pulso.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-1.5 w-3/4 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" />
            </div>
          </div>
        </section>

        {/* Lado direito: form */}
        <section className="flex items-center">
          <div className="w-full">
            {/* Header do form (visivel em mobile) */}
            <div className="mb-8 lg:hidden">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">Entrar na plataforma</h2>
              <p className="mt-2 text-sm text-slate-300">
                Use suas credenciais para abrir o ambiente certo.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,10,14,0.94),rgba(6,8,12,0.98))] p-7 shadow-[0_36px_120px_-56px_rgba(34,211,238,0.55)] sm:p-9">
              {/* Header do form (visivel em desktop) */}
              <div className="hidden lg:block">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Secure access</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Entrar na plataforma</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Use suas credenciais para abrir o ambiente certo.
                </p>
              </div>

              {/* Erro */}
              {error && (
                <div
                  className="mt-6 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="mt-7 space-y-5">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition focus:border-accent/40 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    placeholder="voce@empresa.com"
                  />
                </div>

                {/* Senha com toggle */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="password" className="text-sm font-medium text-slate-200">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowWorkspaceField((current) => !current)}
                      className="text-xs uppercase tracking-[0.24em] text-slate-400 transition hover:text-white"
                    >
                      {showWorkspaceField ? 'Ocultar workspace' : 'Informar workspace'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5 pr-12 text-base text-white placeholder:text-slate-500 transition focus:border-accent/40 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-accent/30"
                      placeholder="Sua senha de acesso"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Workspace (condicional) */}
                {showWorkspaceField && (
                  <div className="animate-slide-up">
                    <label htmlFor="tenant" className="mb-2 block text-sm font-medium text-slate-200">
                      Workspace / tenant
                    </label>
                    <input
                      id="tenant"
                      value={tenantId}
                      onChange={(event) => setTenantId(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition focus:border-accent/40 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-accent/30"
                      placeholder="UUID do workspace, se sua operacao usar um contexto dedicado"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Se sua equipe ja acessa normalmente, este campo pode ficar no padrao salvo no navegador.
                    </p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isBusy}
                  size="lg"
                  className="group h-14 w-full rounded-full bg-white text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:bg-white/40"
                >
                  {isBusy ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Abrindo sua operacao...
                    </>
                  ) : (
                    <>
                      Entrar na plataforma
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>

              {/* Help */}
              <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Precisa de apoio?</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Se voce ainda nao recebeu suas credenciais ou precisa validar o workspace, fale com a equipe de implantacao.
                </p>
              </div>
            </div>

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-slate-500">
              Ao entrar voce concorda com os termos de uso e politica de privacidade.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
