import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Erro 404</p>
        <h1
          className="mt-5 text-[clamp(3rem,8vw,6rem)] font-normal leading-[0.95] tracking-[-0.04em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Não <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>encontrado</em>.
        </h1>
        <p className="mt-6 text-[15px] leading-[1.55] text-[#1a1814]/65">
          A página que você procura não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="group mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
        >
          Voltar ao início
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
