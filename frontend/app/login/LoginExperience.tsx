'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TENANT_ID } from '@/lib/config';

const SENTINEL_TENANT = '00000000-0000-0000-0000-000000000000';
const DEFAULT_WORKSPACE = TENANT_ID === SENTINEL_TENANT ? '' : TENANT_ID;

const trustSignals = [
  'Acesso ao ecossistema premium de operacao',
  'Mesmo padrao visual e funcional em loja, PDV e admin',
  'Fluxo pensado para abrir a rotina sem ruido',
];

const productPathways = [
  {
    title: 'Loja e conversao',
    description: 'Entre para acompanhar a experiencia do cliente final e a leitura do catalogo.',
    href: '/loja',
  },
  {
    title: 'Gestao e comando',
    description: 'Painel executivo, estoque e operacao em um unico cockpit visual.',
    href: '/admin',
  },
  {
    title: 'Atendimento e caixa',
    description: 'PDV fluido para vender com contexto, velocidade e seguranca.',
    href: '/pdv',
  },
];

type LoginExperienceProps = {
  redirectTarget: string;
};

export default function LoginExperience({ redirectTarget }: LoginExperienceProps) {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState(DEFAULT_WORKSPACE);
  const [showWorkspaceField, setShowWorkspaceField] = useState(Boolean(DEFAULT_WORKSPACE));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      startTransition(() => {
        router.replace(redirectTarget);
      });
    }
  }, [isAuthenticated, isLoading, redirectTarget, router]);

  const isBusy = submitting || isPending;

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

    startTransition(() => {
      router.replace(redirectTarget);
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 mesh-gradient opacity-70" />
      <div className="absolute inset-0 grid-pattern-fade opacity-30" />
      <div className="absolute left-[12%] top-20 h-72 w-72 rounded-full bg-accent/12 blur-[120px]" />
      <div className="absolute bottom-0 right-[10%] h-96 w-96 rounded-full bg-accent-secondary/12 blur-[140px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-6 py-6 sm:px-8 lg:px-10 lg:py-8">
        <header className="flex items-center justify-between gap-4 pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/92 text-sm font-semibold tracking-[0.24em] text-slate-950 shadow-[0_18px_60px_-32px_rgba(255,255,255,0.85)]">
              GT
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-white">GTSoftHub</p>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Premium retail platform</p>
            </div>
          </Link>

          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-full border border-white/12 bg-white/6 px-5 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10">
            Voltar para a experiencia
          </Link>
        </header>

        <main className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.88fr)] lg:items-stretch">
          <section className="relative overflow-hidden rounded-[2.2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-7 sm:p-9 lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.18),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.16),transparent_32%)]" />
            <div className="relative flex h-full flex-col">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-accent">
                  Entrada da operacao
                </span>
                <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[0.95] tracking-[-0.05em] text-white sm:text-5xl xl:text-[4.5rem]">
                  O acesso precisa transmitir a mesma sensacao de controle que o produto entrega por dentro.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Aqui o empreendedor entra em uma plataforma pensada para operar com beleza, criterio e zero improviso. Tudo o que vem depois precisa parecer inevitavelmente premium.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {trustSignals.map((signal) => (
                  <div key={signal} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    {signal}
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 xl:grid-cols-3">
                {productPathways.map((pathway) => (
                  <Link
                    key={pathway.title}
                    href={pathway.href}
                    className="rounded-[1.6rem] border border-white/8 bg-slate-950/45 p-5 transition hover:-translate-y-1 hover:border-white/16"
                  >
                    <p className="text-lg font-semibold tracking-[-0.02em] text-white">{pathway.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{pathway.description}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent">
                      Explorar
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-8 rounded-[1.9rem] border border-white/8 bg-slate-950/50 p-6 sm:p-7">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Signal room</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Tudo pronto para abrir o dia com serenidade.</p>
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Ambientes operacionais online
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Loja premium', 'Vitrine elegante e checkout fluido.'],
                    ['Admin executivo', 'Leitura imediata de vendas, canais e decisoes.'],
                    ['Estoque vivo', 'Risco, minimo e ajuste na mesma experiencia.'],
                  ].map(([title, description]) => (
                    <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center">
            <div className="w-full rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,10,14,0.94),rgba(6,8,12,0.98))] p-7 shadow-[0_36px_120px_-56px_rgba(34,211,238,0.65)] sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Secure access</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Entre para comandar a operacao</h2>
                </div>
                <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 sm:block">
                  Login seguro com tenant e sessao autenticada
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                Use suas credenciais para abrir o ambiente certo. Se voce tiver um workspace dedicado, informe abaixo para manter a operacao no contexto correto.
              </p>

              {error && (
                <div className="mt-6 rounded-[1.4rem] border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" aria-live="polite">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
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
                    className="w-full rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="voce@empresa.com"
                  />
                </div>

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
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="Sua senha de acesso"
                  />
                </div>

                {showWorkspaceField && (
                  <div>
                    <label htmlFor="tenant" className="mb-2 block text-sm font-medium text-slate-200">
                      Workspace / tenant
                    </label>
                    <input
                      id="tenant"
                      value={tenantId}
                      onChange={(event) => setTenantId(event.target.value)}
                      className="w-full rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="UUID do workspace, se sua operacao usar um contexto dedicado"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Se sua equipe ja acessa normalmente, este campo pode ficar no padrao salvo no navegador.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="group inline-flex h-14 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:cursor-not-allowed disabled:bg-white/40"
                >
                  {isBusy ? 'Abrindo sua operacao...' : 'Entrar na plataforma'}
                  {!isBusy && (
                    <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Precisa de apoio?</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Se voce ainda nao recebeu suas credenciais ou precisa validar o workspace da sua operacao, fale com a equipe responsavel pela implantacao antes de entrar.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
