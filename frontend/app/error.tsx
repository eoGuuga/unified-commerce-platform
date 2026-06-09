'use client';

import { useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Erro</p>
        <h1
          className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Algo <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>inesperado</em>.
        </h1>
        <p className="mt-6 text-[15px] leading-[1.55] text-[#1a1814]/65">
          Ocorreu um erro. Tente novamente em instantes.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-6 text-left text-[12px] text-[#1a1814]/70 overflow-auto border border-[#1a1814]/15 bg-white/40 p-3 rounded-[2px]">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ''}
          </pre>
        )}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
          >
            Tentar novamente
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 transition hover:text-[#1a1814]"
          >
            Voltar ao inicio
          </button>
        </div>
      </div>
    </div>
  );
}
