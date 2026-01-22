import { Container } from "./Container"
import Link from "next/link"

export function FinalCTA() {
  return (
    <section id="demo" className="section-padding">
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-border/20">
          {/* Background */}
          <div className="absolute inset-0 bg-foreground" />
          
          {/* Subtle pattern */}
          <div className="absolute inset-0 opacity-[0.02]">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '32px 32px'
            }} />
          </div>
          
          <div className="relative px-6 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20 xl:px-16 xl:py-24">
            <div className="max-w-2xl mx-auto text-center">
              {/* Badge with signature sync pulse */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/8 border border-background/10 mb-8">
                <span className="relative flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="absolute w-1.5 h-1.5 rounded-full bg-accent animate-ping opacity-40" style={{ animationDuration: "2s" }} />
                </span>
                <span className="text-xs text-background/60 uppercase tracking-[0.06em] font-medium">Sistema operacional</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem] font-semibold tracking-tight leading-tight mb-6 text-background">
                Traga previsibilidade
                <span className="block text-background/50 mt-1">para sua opera��o.</span>
              </h2>
              
              <p className="text-base text-background/50 mb-10 max-w-lg mx-auto leading-[1.6]">
                Comece hoje mesmo e elimine o overselling da sua opera��o. 
                Teste gr�tis por 14 dias, sem compromisso.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <Link
                  href="#"
                  className="inline-flex items-center justify-center gap-2.5 h-12 px-7 text-sm font-medium bg-background text-foreground rounded-lg transition-colors hover:bg-background/90"
                >
                  Ver demo ao vivo
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="#precos"
                  className="inline-flex items-center justify-center h-12 px-7 text-sm font-medium text-background/70 border border-background/15 rounded-lg transition-colors hover:bg-background/5"
                >
                  Ver planos
                </Link>
              </div>
              
              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-background/40">
                {[
                  "Setup em 5 minutos",
                  "Sem cart�o de cr�dito",
                  "Cancele quando quiser"
                ].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
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
