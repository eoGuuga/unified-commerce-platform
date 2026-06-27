'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { TENANT_ID } from '@/lib/config';

const SENTINEL_TENANT = '00000000-0000-0000-0000-000000000000';
const DEFAULT_WORKSPACE = TENANT_ID === SENTINEL_TENANT ? '' : TENANT_ID;

/**
 * Login - editorial off-white.
 * Split 50/50, tipografia serif no lado esquerdo, form limpo no direito.
 */
export default function LoginExperience({ redirectTarget }: { redirectTarget: string }) {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantId, setTenantId] = useState(DEFAULT_WORKSPACE);
  const [showWorkspaceField, setShowWorkspaceField] = useState(Boolean(DEFAULT_WORKSPACE));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814]">
      {/* Header */}
      <header className="border-b border-[#1a1814]/8">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#1a1814] text-[10px] font-semibold text-[#f6f3ee]">
              GT
            </div>
            <span
              className="text-[15px] font-medium tracking-[-0.01em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              GTSoftHub
            </span>
          </Link>
          <Link
            href="/"
            className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/55 transition hover:text-[#1a1814]"
          >
            Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1320px] items-center gap-16 px-6 py-12 lg:grid-cols-2">
        {/* Lado esquerdo - brand editorial */}
        <section className="hidden lg:block">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
            Acesso
          </p>
          <h1
            className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            A operação que <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>respira</em> em uníssono.
          </h1>
          <p className="mt-6 max-w-md text-[16px] leading-[1.55] text-[#1a1814]/70">
            Estoque, PDV, bot de WhatsApp e atendimento compartilhando a mesma fonte de verdade. A plataforma que devolve ritmo e serenidade.
          </p>

          <div className="mt-12 space-y-3">
            {[
              { t: 'Sessao criptografada end-to-end' },
              { t: 'Acesso direto a operacao' },
              { t: 'UX premium em todos os modulos' },
            ].map((s) => (
              <div
                key={s.t}
                className="flex items-center gap-3 border-b border-[#1a1814]/8 py-3"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#b8654a]" />
                <span className="text-[14px] text-[#1a1814]/80">{s.t}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Lado direito - form */}
        <section className="mx-auto w-full max-w-md">
          <div className="lg:hidden mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
              Acesso
            </p>
            <h1
              className="mt-4 text-[36px] font-normal leading-[1] tracking-[-0.03em]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Entrar na plataforma.
            </h1>
          </div>

          <div className="rounded-[4px] border border-[#1a1814]/8 bg-white/40 p-8 sm:p-10">
            <h2
              className="hidden text-[28px] font-normal leading-[1.1] tracking-[-0.03em] lg:block"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Entrar
            </h2>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#1a1814]/60">
              Use suas credenciais para abrir o ambiente certo.
            </p>

            {error && (
              <div className="mt-6 rounded-[2px] border border-[#1a1814]/15 bg-[#1a1814]/5 px-4 py-3 text-[13px] text-[#1a1814]" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-[2px] border border-[#1a1814]/15 bg-white/60 px-4 py-3 text-[15px] text-[#1a1814] placeholder:text-[#1a1814]/35 transition focus:border-[#1a1814]/40 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#b8654a]/25"
                  placeholder="voce@empresa.com"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowWorkspaceField((c) => !c)}
                    className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#1a1814]/40 transition hover:text-[#1a1814]"
                  >
                    {showWorkspaceField ? 'Ocultar workspace' : 'Informar workspace'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-[2px] border border-[#1a1814]/15 bg-white/60 px-4 py-3 pr-12 text-[15px] text-[#1a1814] placeholder:text-[#1a1814]/35 transition focus:border-[#1a1814]/40 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#b8654a]/25"
                    placeholder="Sua senha de acesso"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((c) => !c)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#1a1814]/40 transition hover:bg-[#1a1814]/5 hover:text-[#1a1814]"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {showWorkspaceField && (
                <div>
                  <label htmlFor="tenant" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55">
                    Workspace
                  </label>
                  <input
                    id="tenant"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="w-full rounded-[2px] border border-[#1a1814]/15 bg-white/60 px-4 py-3 text-[15px] text-[#1a1814] placeholder:text-[#1a1814]/35 transition focus:border-[#1a1814]/40 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#b8654a]/25"
                    placeholder="UUID do workspace"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a1814] text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90 disabled:opacity-50"
              >
                {isBusy ? (
                  'Abrindo...'
                ) : (
                  <>
                    Entrar na plataforma
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-[#1a1814]/8 pt-6 text-center text-[12px] text-[#1a1814]/50">
              <Link href="/" className="transition hover:text-[#1a1814]">
                Voltar para a experiencia
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
