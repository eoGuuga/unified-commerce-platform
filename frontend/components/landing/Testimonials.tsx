import { Container } from "./Container"

const testimonials = [
  {
    quote: "Antes da UCM, perdíamos em média 15 vendas por semana por overselling. Hoje esse número é zero. A sincronização em tempo real mudou completamente nossa operação.",
    author: "Marina Santos",
    role: "Diretora de Operações",
    company: "ModaPlus",
  },
  {
    quote: "O bot de WhatsApp integrado foi um divisor de águas. Nossos clientes consultam disponibilidade e fecham pedidos 24/7, tudo sincronizado automaticamente.",
    author: "Rafael Oliveira",
    role: "CEO",
    company: "TechStore",
  },
]

export function Testimonials() {
  return (
    <section className="py-20 lg:py-32">
      <Container>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            O que nossos clientes dizem
          </h2>
          <p className="text-lg text-muted-foreground">
            Histórias reais de transformação operacional.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="p-8 lg:p-10 rounded-2xl bg-card border border-border hover:shadow-xl transition-shadow duration-300"
            >
              {/* Quote icon */}
              <svg className="w-10 h-10 text-accent/30 mb-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              
              <blockquote className="text-lg text-foreground leading-relaxed mb-6">
                {testimonial.quote}
              </blockquote>
              
              <div className="flex items-center gap-4">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-lg font-semibold text-muted-foreground">
                    {testimonial.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role} · {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

