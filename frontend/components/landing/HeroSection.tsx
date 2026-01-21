import Link from "next/link";

const menuItems = [
  { label: "Problema", href: "#problema" },
  { label: "Solução", href: "#solucao" },
  { label: "Como Funciona", href: "#fluxo" },
  { label: "Planos", href: "#planos" },
];

const trustBadges = ["Transações ACID", "Sync em Tempo Real", "99,99% Uptime"];

export function HeroSection() {
  return (
    <section className="bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-7xl px-6 pb-16 pt-10 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
              UCM
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              Unified Commerce
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-slate-600 lg:flex" aria-label="Navegação">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-slate-600 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300">
              Entrar
            </Link>
            <Link
              href="#contato"
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white transition hover:-translate-y-[1px] hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              Ver Demo ao Vivo â†’
            </Link>
          </div>
        </header>

        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Zero Overselling Garantido
            </span>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Venda em todos os canais.{" "}
                <span className="text-blue-600">Sem conflitos.</span>
              </h1>
              <p className="text-lg text-slate-600">
                Backend centralizado que sincroniza estoque em tempo real entre PDV, e-commerce e WhatsApp.{" "}
                <strong className="font-semibold text-slate-900">Uma única fonte da verdade.</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="#contato"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-[1px] hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                  â–¶
                </span>
                Ver Demo ao Vivo
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Entrar
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-xs font-semibold text-slate-500">
              {trustBadges.map((badge) => (
                <span key={badge} className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="uppercase tracking-[0.2em]">Sistema Operacional</span>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      â—
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Backend Central</p>
                      <p className="text-xs text-slate-500">Fonte única da verdade</p>
                    </div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "PDV Físico", status: "Sincronizado" },
                    { label: "E-commerce", status: "Sincronizado" },
                    { label: "WhatsApp", status: "Sincronizado" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                      <p className="font-semibold text-slate-800">{item.label}</p>
                      <p className="mt-2 text-emerald-600">{item.status}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-emerald-700">
                    âœ“
                  </span>
                  Última Transação
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="flex justify-between">
                    <span>Produto:</span>
                    <span className="font-semibold text-slate-800">Camiseta Premium #42</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Canal:</span>
                    <span className="font-semibold text-slate-800">WhatsApp Bot</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-semibold text-emerald-700">Reservado</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estoque Atualizado:</span>
                    <span className="font-semibold text-slate-800">2,3s</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 right-6 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
              <p className="text-xs text-slate-500">Overselling</p>
              <p className="text-lg font-semibold text-emerald-600">0</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

