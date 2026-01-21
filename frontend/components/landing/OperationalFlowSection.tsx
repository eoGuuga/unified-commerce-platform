import { ShoppingCart, Lock, CreditCard, Truck, Search, Zap, Bell } from "lucide-react";

const steps = [
  {
    step: "1",
    title: "Captura",
    subtitle: "Cliente escolhe produto",
    accent: "border-blue-400",
    items: [
      { icon: ShoppingCart, title: "Adiciona ao carrinho", text: "Cliente seleciona produto em qualquer canal" },
      { icon: Search, title: "Consulta disponibilidade", text: "Sistema verifica estoque em tempo real" },
    ],
    footer: "Tempo médio: 2-5s",
  },
  {
    step: "2",
    title: "Reserva",
    subtitle: "Produto bloqueado",
    accent: "border-amber-400",
    items: [
      { icon: Lock, title: "Lock atômico", text: "Produto reservado exclusivamente para este cliente" },
      { icon: Zap, title: "Sync instantâneo", text: "Todos os canais atualizam: “indisponível”" },
    ],
    footer: "Tempo de lock: <100ms",
  },
  {
    step: "3",
    title: "Confirmação",
    subtitle: "Pagamento validado",
    accent: "border-emerald-400",
    items: [
      { icon: CreditCard, title: "Processa pagamento", text: "Pix, cartão ou outro método validado" },
      { icon: ShoppingCart, title: "Confirma pedido", text: "Venda finalizada, estoque deduzido" },
    ],
    footer: "Tempo médio: 5-30s",
  },
  {
    step: "4",
    title: "Entrega",
    subtitle: "Ciclo completo",
    accent: "border-slate-400",
    items: [
      { icon: Truck, title: "Prepara envio", text: "Logística acionada automaticamente" },
      { icon: Bell, title: "Notifica cliente", text: "Confirmação e tracking enviados" },
    ],
    footer: "Status: Completo",
  },
];

export function OperationalFlowSection() {
  return (
    <section id="fluxo" className="bg-white py-20 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 text-center lg:px-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-600">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Fluxo Operacional
        </span>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">Como funciona na prática</h2>
        <p className="mt-3 text-base text-slate-600">
          Do momento que o cliente escolhe o produto até a entrega. Cada etapa é rastreada, validada e sincronizada.
        </p>
      </div>

      <div className="mx-auto mt-12 w-full max-w-6xl px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.step} className={`rounded-2xl border-2 ${step.accent} bg-white p-6 text-left shadow-sm`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                {step.step}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{step.subtitle}</p>

              <div className="mt-4 space-y-3">
                {step.items.map((item) => (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      <p className="text-xs font-semibold text-slate-700">{item.title}</p>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-xs text-slate-500">{step.footer}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
