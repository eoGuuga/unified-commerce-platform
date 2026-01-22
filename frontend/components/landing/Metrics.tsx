import { Container } from "./Container"

const metrics = [
  {
    value: "99,99%",
    label: "Uptime garantido",
    description: "Disponibilidade cont�nua",
  },
  {
    value: "<100ms",
    label: "Sincroniza��o",
    description: "Lat�ncia de estoque",
  },
  {
    value: "0",
    label: "Overselling",
    description: "Casos registrados",
  },
  {
    value: "+2,4k",
    label: "Pedidos/dia",
    description: "Em opera��o ativa",
  },
]

export function Metrics() {
  return (
    <section className="py-20 lg:py-32 bg-muted/30">
      <Container>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            N�meros que comprovam
          </h2>
          <p className="text-lg text-muted-foreground">
            Resultados reais de clientes em produ��o.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="text-center p-8 rounded-2xl bg-card border border-border hover:shadow-lg transition-shadow duration-300"
            >
              <p className="text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-2">
                {metric.value}
              </p>
              <p className="font-semibold text-foreground mb-1">
                {metric.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
