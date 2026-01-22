import { Container } from "./Container"
import Link from "next/link"

export function FinalCTA() {
  return (
    <section id="demo" className="py-32 lg:py-40">
      <Container>
        <div className="relative overflow-hidden rounded-3xl">
          {/* Background */}
          <div className="absolute inset-0 bg-foreground" />
          <div className="absolute inset-0 grid-pattern-sm opacity-5" />
          
          {/* Gradient orbs */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/30 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-[100px]" />
          
          <div className="relative px-8 py-20 lg:px-20 lg:py-28">
            <div className="max-w-3xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/10 border border-background/10 mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="text-sm font-medium text-background/80">Comece em menos de 5 minutos</span>
              </div>
              
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-background tracking-tight leading-[1.1] mb-6">
                Traga previsibilidade
                <span className="block text-background/60">para sua operacao.</span>
              </h2>
              
              <p className="text-lg lg:text-xl text-background/60 mb-12 max-w-xl mx-auto">
                Comece hoje mesmo e elimine o overselling da sua operacao. 
                Teste gratis por 14 dias, sem compromisso.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Link
                  href="#"
                  className="group inline-flex items-center justify-center px-8 py-4 text-base font-semibold bg-background text-foreground rounded-full hover:bg-background/90 transition-all duration-300 hover:shadow-2xl hover:shadow-background/20"
                >
                  Ver demo ao vivo
                  <svg className="ml-2.5 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="#precos"
                  className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-background/80 border border-background/20 rounded-full hover:bg-background/5 transition-all duration-300"
                >
                  Ver planos
                </Link>
              </div>
              
              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-background/50">
                {[
                  "Setup em 5 minutos",
                  "Sem cartao de credito",
                  "Cancele quando quiser"
                ].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
