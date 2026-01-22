import { Container } from "./Container"

export function Logos() {
  const logos = [
    "TechStore",
    "ModaPlus",
    "CasaF�cil",
    "SportMax",
    "BeautyShop",
    "FarmaBem",
  ]

  return (
    <section className="py-16 border-y border-border">
      <Container>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Empresas que confiam na UCM para suas opera��es
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
          {logos.map((logo) => (
            <div
              key={logo}
              className="flex items-center justify-center px-4 py-2 opacity-50 hover:opacity-80 transition-opacity duration-200"
            >
              <span className="text-lg font-semibold text-muted-foreground tracking-tight">
                {logo}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
