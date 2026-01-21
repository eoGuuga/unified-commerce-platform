import { ShieldCheck, Zap, Headphones } from "lucide-react";

const items = [
  {
    title: "Zero Overselling",
    description: "Garantia absoluta em todos os planos",
    icon: ShieldCheck,
  },
  {
    title: "Sync Tempo Real",
    description: "Atualização instantânea entre canais",
    icon: Zap,
  },
  {
    title: "Suporte Técnico",
    description: "Time especializado para ajudar",
    icon: Headphones,
  },
];

export function PlansIncludesSection() {
  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto w-full max-w-5xl px-6 lg:px-10">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Todos os planos incluem</h3>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {items.map((item) => (
              <div key={item.title} className="space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

