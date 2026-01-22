import { Container } from "./Container"

const differentials = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Zero overselling",
    description: "Transa��es ACID com reserva at�mica. Cada venda bloqueia o estoque instantaneamente, impossibilitando vendas duplicadas.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: "WhatsApp Bot nativo",
    description: "Bot integrado que consulta estoque em tempo real, processa pedidos e atualiza disponibilidade automaticamente.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Opera��o cont�nua",
    description: "Infraestrutura redundante com failover autom�tico. Sua opera��o nunca para, mesmo em picos de demanda.",
  },
]

export function Differentials() {
  return (
    <section className="py-20 lg:py-32 bg-surface-dark text-surface-dark-foreground">
      <Container>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Por que escolher a UCM
          </h2>
          <p className="text-lg opacity-70">
            Tecnologia de ponta para opera��es que n�o podem falhar.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {differentials.map((diff) => (
            <div
              key={diff.title}
              className="group p-6 lg:p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center text-accent mb-5">
                {diff.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">
                {diff.title}
              </h3>
              <p className="opacity-70 leading-relaxed">
                {diff.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
