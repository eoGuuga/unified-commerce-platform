import { Container } from "./Container"

const bullets = [
  {
    title: "O que é a UCM",
    description:
      "Uma plataforma que unifica PDV, e-commerce e WhatsApp em um só lugar para sua operação trabalhar sincronizada.",
  },
  {
    title: "O que ela resolve",
    description:
      "Evita vendas duplicadas, reduz retrabalho e dá visão clara do que realmente está disponível no estoque.",
  },
  {
    title: "Como funciona na prática",
    description:
      "Quando um pedido entra, o estoque é atualizado na hora em todos os canais. Tudo fica alinhado, sem ruído.",
  },
]

const glossary = [
  {
    term: "Sincronização em tempo real",
    meaning: "Todos os canais veem o mesmo estoque na hora.",
  },
  {
    term: "Reserva automática",
    meaning: "O produto é separado assim que o pedido é iniciado.",
  },
  {
    term: "Operação omnichannel",
    meaning: "Vendas em vários canais funcionando como um só.",
  },
]

export function Explainer() {
  return (
    <section id="explicacao" className="section-padding-compact relative">
      <Container>
        <div className="max-w-3xl mx-auto text-center section-header-gap">
          <div className="badge-base mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>Explicação em 1 minuto</span>
          </div>
          <h2 className="mb-5">
            <span className="text-foreground">Sem jargão.</span>
            <span className="block text-muted-foreground mt-1">
              Direto ao ponto.
            </span>
          </h2>
          <p className="body-text-lg mx-auto">
            A UCM foi criada para simplificar sua operação. Aqui vai o essencial
            para você entender o que entregamos, em linguagem simples.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
          {bullets.map((item) => (
            <div key={item.title} className="card-base card-interactive p-6">
              <h3 className="card-title mb-3">{item.title}</h3>
              <p className="small-text">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 lg:mt-12 max-w-3xl mx-auto">
          <div className="card-elevated p-6 lg:p-7">
            <p className="label-text mb-4">Glossário rápido</p>
            <div className="space-y-4">
              {glossary.map((item) => (
                <div
                  key={item.term}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-6"
                >
                  <span className="text-sm font-medium text-foreground">
                    {item.term}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.meaning}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
