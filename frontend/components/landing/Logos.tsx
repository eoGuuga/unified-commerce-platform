import { Container } from "./Container"

export function Logos() {
  return (
    <section className="section-padding-compact relative">
      <Container className="relative">
        <div className="flex items-center gap-6 mb-8">
          <div className="h-px flex-1 bg-border/30" />
          <p className="text-xs text-muted-foreground text-center px-4 uppercase tracking-[0.06em] font-medium">
            Programa de early access
          </p>
          <div className="h-px flex-1 bg-border/30" />
        </div>
        
        <div className="max-w-xl mx-auto text-center">
          <p className="small-text leading-relaxed mb-5">
            Estamos em fase de implantação com um grupo selecionado de varejistas. 
            Vagas limitadas para novos pilotos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="badge-base text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Pilotos em andamento
            </span>
            <span className="badge-base text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Vagas limitadas
            </span>
          </div>
        </div>
      </Container>
    </section>
  )
}


