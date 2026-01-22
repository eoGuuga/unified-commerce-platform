import { Container } from "./Container"

export function FinalCTA() {
  return (
    <section id="demo" className="py-20 lg:py-32">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-primary p-10 lg:p-16 text-center">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-primary-foreground tracking-tight mb-6 text-balance">
              Traga previsibilidade para sua opera��o
            </h2>
            <p className="text-lg lg:text-xl text-primary-foreground/80 mb-10">
              Comece hoje mesmo e elimine o overselling da sua opera��o. Teste gr�tis por 14 dias, sem compromisso.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-medium bg-primary-foreground text-primary rounded-lg hover:bg-primary-foreground/90 transition-all duration-200 hover:shadow-xl"
              >
                Ver demo ao vivo
                <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <a
                href="#planos"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-primary-foreground border border-primary-foreground/30 rounded-lg hover:bg-white/10 transition-all duration-200"
              >
                Ver planos
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
