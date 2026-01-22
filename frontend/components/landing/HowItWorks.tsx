import { Container } from "./Container"

const steps = [
  {
    step: "01",
    title: "Captura",
    description: "Pedido entra por qualquer canal e � capturado instantaneamente pelo backend central.",
  },
  {
    step: "02",
    title: "Reserva",
    description: "Estoque � reservado atomicamente antes de qualquer confirma��o. Bloqueio imediato.",
  },
  {
    step: "03",
    title: "Confirma��o",
    description: "Transa��o validada com sucesso. Estoque atualizado em todos os canais simultaneamente.",
  },
  {
    step: "04",
    title: "Entrega",
    description: "Pedido segue para fulfillment com rastreamento integrado e status em tempo real.",
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-20 lg:py-32">
      <Container>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            Como funciona
          </h2>
          <p className="text-lg text-muted-foreground">
            Do pedido � entrega em quatro etapas automatizadas.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-16 left-0 right-0 h-px bg-border" />
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => (
              <div key={step.step} className="relative">
                {/* Step number */}
                <div className="relative z-10 w-12 h-12 mx-auto lg:mx-0 mb-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  {step.step}
                </div>
                
                {/* Arrow for desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full -translate-y-1/2 px-4">
                    <svg className="w-full h-4 text-border" viewBox="0 0 100 16" fill="none">
                      <path d="M0 8h96M92 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                
                {/* Content */}
                <div className="text-center lg:text-left">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
