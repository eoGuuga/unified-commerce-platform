import { Container } from "./Container"

export function Logos() {
  const logos = [
    "Centauro", "Tok&Stok", "Riachuelo", "Hering", "Renner", "Arezzo"
  ]

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />
      
      <Container className="relative">
        <div className="flex items-center gap-8 mb-12">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <p className="text-sm text-muted-foreground text-center px-4">
            Confiado por lideres do varejo brasileiro
          </p>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
          {logos.map((logo, i) => (
            <div
              key={logo}
              className="group relative"
            >
              <span className="text-2xl font-semibold tracking-tight text-muted-foreground/30 group-hover:text-muted-foreground transition-all duration-500 cursor-default">
                {logo}
              </span>
              <div className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
