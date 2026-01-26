'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response: any = await api.login(email, password);
      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        router.push('/pdv');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell full-bleed flex items-center justify-center p-6">
      <div className="absolute inset-0 signal-grid opacity-70" />
      <div className="relative w-full max-w-md signal-panel rounded-3xl p-8">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300">GTSOFT HUB</p>
          <h1 className="text-3xl font-semibold text-white mt-3">GTSoftHub Platform</h1>
          <p className="text-slate-200 mt-2">Entre com suas credenciais</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--signal-cyan)]"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-2">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--signal-cyan)]"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:bg-white/40 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-300">
            Precisa de acesso? Fale com a equipe para liberar sua demonstraÃ§Ã£o.
          </p>
        </div>
      </div>
    </div>
  );
}

