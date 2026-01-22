import { Container } from "./Container"

const testimonials = [
  {
    quote: "Antes da UCM, perdiamos em media 15 vendas por semana por overselling. Hoje esse numero e zero. A sincronizacao em tempo real mudou completamente nossa operacao.",
    author: "Marina Santos",
    role: "Diretora de Operacoes",
    company: "ModaPlus",
    metric: "-100%",
    metricLabel: "overselling",
  },
  {
    quote: "O bot de WhatsApp integrado foi um divisor de aguas. Nossos clientes consultam disponibilidade e fecham pedidos 24/7, tudo sincronizado automaticamente.",
    author: "Rafael Oliveira",
    role: "CEO",
    company: "TechStore",
    metric: "+43%",
    metricLabel: "conversoes",
  },
]

export function Testimonials() {
  return (
    <section className="py-32 lg:py-40 relative">
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass glass-border mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Depoimentos</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground tracking-tight leading-[1.1] mb-6">
            O que nossos clientes
            <span className="block text-muted-foreground">dizem.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="group relative"
            >
              <div className="relative p-8 lg:p-10 rounded-2xl border-gradient overflow-hidden h-full transition-all duration-500 hover:translate-y-[-4px]">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative">
                  {/* Metric Badge */}
                  <div className="absolute -top-2 right-0 flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                    <span className="text-lg font-semibold text-accent">{testimonial.metric}</span>
                    <span className="text-xs text-muted-foreground">{testimonial.metricLabel}</span>
                  </div>
                  
                  {/* Quote Icon */}
                  <svg className="w-10 h-10 text-accent/30 mb-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  
                  {/* Quote */}
                  <blockquote className="text-lg lg:text-xl text-foreground leading-relaxed mb-8">
                    "{testimonial.quote}"
                  </blockquote>
                  
                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center">
                      <span className="text-lg font-semibold text-accent">
                        {testimonial.author.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
