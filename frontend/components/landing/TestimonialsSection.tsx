const testimonials = [
  {
    name: "Marina Silva",
    role: "Dona, Boutique Fashion",
    quote:
      "Antes da UCM, eu perdia vendas toda semana por overselling. Agora eu durmo tranquila. O sistema simplesmente funciona.",
    stats: [
      { value: "100%", label: "Sem overselling" },
      { value: "3 canais", label: "Sincronizados" },
      { value: "+45%", label: "Vendas online" },
    ],
  },
  {
    name: "Carlos Mendes",
    role: "Gestor, Tech Store",
    quote:
      "O WhatsApp Bot mudou meu negócio. Cliente pede, o bot valida estoque, processa pagamento. Eu só preparo o envio.",
    stats: [
      { value: "70%", label: "Vendas WhatsApp" },
      { value: "24/7", label: "Operação" },
      { value: "-80%", label: "Tempo atendimento" },
    ],
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-2">
          {testimonials.map((item) => (
            <div key={item.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-200" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.role}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600">“{item.quote}”</p>

              <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs">
                {item.stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-base font-semibold text-slate-900">{stat.value}</p>
                    <p className="text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
