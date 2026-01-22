import { Container } from "./Container"

const concerns = [
  {
    title: "Perda de vendas por overselling",
    description: "Vendas duplicadas em canais diferentes que geram reembolsos, frustra��o do cliente e dano � reputa��o da marca.",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  },
  {
    title: "Horas gastas em confer�ncias manuais",
    description: "Equipes inteiras dedicadas a verificar estoque entre sistemas, atualizar planilhas e corrigir inconsist�ncias diariamente.",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    title: "Clientes comprando produtos esgotados",
    description: "E-commerce mostrando disponibilidade enquanto o produto j� foi vendido na loja f�sica ou em outro canal.",
    icon: "M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  },
  {
    title: "Dificuldade de escalar opera��o",
    description: "Adicionar novos canais de venda se torna um pesadelo operacional quando os sistemas n�o conversam entre si.",
    icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5",
  },
]

export function Testimonials() {
  return (
    <section id="depoimentos" className="section-padding relative bg-secondary/15">
      <Container>
        <div className="text-center max-w-3xl mx-auto section-header-gap">
          <div className="badge-base mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>Por que UCM</span>
          </div>
          
          <h2 className="mb-5">
            <span className="text-foreground">Problemas reais que</span>
            <span className="block text-muted-foreground mt-1">resolvemos.</span>
          </h2>
          
          <p className="body-text-lg mx-auto">
            Se voc� vende em m�ltiplos canais, provavelmente j� enfrentou essas situa��es. 
            A UCM foi projetada para elimin�-las.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 lg:gap-6 xl:gap-7">
          {concerns.map((concern) => (
            <div
              key={concern.title}
              className="relative p-6 lg:p-7 xl:p-8 card-elevated card-interactive"
            >
              {/* Icon */}
              <div className="icon-box bg-accent/8 mb-5">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={concern.icon} />
                </svg>
              </div>
              
              {/* Content */}
              <h3 className="card-title mb-3">
                {concern.title}
              </h3>
              <p className="small-text leading-relaxed">
                {concern.description}
              </p>
            </div>
          ))}
        </div>
        
        {/* CTA */}
        <div className="mt-10 lg:mt-12 xl:mt-14 text-center">
          <p className="small-text mb-6">
            Quer entender como a UCM pode ajudar sua opera��o?
          </p>
          <a 
            href="#demo" 
            className="btn-primary"
          >
            Agendar demonstra��o
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </Container>
    </section>
  )
}
