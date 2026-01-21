import { Database, Repeat2, Lock, RefreshCw } from "lucide-react";

const cards = [
  {
    title: "Transações ACID",
    description:
      "Atomicidade, consistência, isolamento e durabilidade. Cada venda é uma transação completa ou nada acontece.",
    code: ["BEGIN TRANSACTION", "CHECK_STOCK", "RESERVE_ITEM", "PROCESS_PAYMENT", "COMMIT"],
    icon: Database,
  },
  {
    title: "Event-Driven Sync",
    description: "Toda mudança de estoque dispara eventos instantâneos para todos os canais conectados.",
    code: ["STOCK_UPDATED", "? PDV: sync", "? E-commerce: sync", "? WhatsApp: sync", "[23ms total]"],
    icon: Repeat2,
  },
  {
    title: "Pessimistic Locking",
    description:
      "Produto em processo de venda é bloqueado imediatamente. Outros canais veem “indisponível” em tempo real.",
    code: ["LOCK product_id=42", "STATUS: reserved", "TIMEOUT: 10min", "AUTO_RELEASE: if unpaid"],
    icon: Lock,
  },
  {
    title: "Automatic Rollback",
    description: "Se pagamento falhar ou cliente desistir, produto volta ao estoque automaticamente.",
    code: ["PAYMENT_FAILED", "ROLLBACK transaction", "RELEASE lock", "NOTIFY channels", "[instant]"],
    icon: RefreshCw,
  },
];

export function TechnicalArchitectureSection() {
  return (
    <section className="bg-slate-900 py-20 text-white">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-10">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Arquitetura Técnica que Importa</h2>
            <p className="mt-2 text-sm text-slate-300">
              Não é buzzword. É engenharia real que garante confiabilidade.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {cards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-emerald-300">
                    <card.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                </div>
                <p className="mt-3 text-sm text-slate-300">{card.description}</p>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
                  {card.code.map((line) => (
                    <div key={line} className="font-mono">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
