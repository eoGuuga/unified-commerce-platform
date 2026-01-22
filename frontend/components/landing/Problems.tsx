import { Container } from "./Container"

const problems = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    title: "Overselling constante",
    description: "Vendas simult�neas em m�ltiplos canais causam promessas imposs�veis de cumprir. Clientes frustrados, reembolsos e reputa��o prejudicada.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: "Dessincronia de estoque",
    description: "Sistemas que n�o conversam entre si. Planilhas manuais, integra��es fr�geis e dados desatualizados que geram decis�es erradas.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
      </svg>
    ),
    title: "Carga mental excessiva",
    description: "Sua equipe gasta horas apagando inc�ndios. Confer�ncias manuais, liga��es de clientes insatisfeitos e opera��o sempre no limite.",
  },
]

export function Problems() {
  return (
    <section id="problema" className="py-20 lg:py-32">
      <Container>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            Problemas que voc� conhece bem
          </h2>
          <p className="text-lg text-muted-foreground">
            Se voc� vende em m�ltiplos canais, provavelmente j� enfrentou isso.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="group p-6 lg:p-8 rounded-2xl bg-card border border-border hover:border-destructive/30 hover:shadow-lg hover:shadow-destructive/5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive mb-5">
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {problem.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
