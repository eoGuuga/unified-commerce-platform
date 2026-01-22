import { Container } from "./Container"

export function Hero() {
  return (
    <section className="pt-32 pb-20 lg:pt-40 lg:pb-32">
      <Container>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="max-w-xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-medium text-accent">Zero overselling garantido</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight tracking-tight text-balance mb-6">
              Venda em todos os canais. Sem conflitos.
            </h1>

            {/* Subheadline */}
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-8">
              Backend centralizado que sincroniza estoque em tempo real entre PDV, e-commerce e WhatsApp. Uma �nica fonte da verdade.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#demo"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 hover:shadow-xl hover:shadow-primary/20"
              >
                Ver demo ao vivo
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <a
                href="#planos"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium bg-secondary text-secondary-foreground rounded-lg border border-border hover:bg-muted transition-all duration-200"
              >
                Come�ar teste
              </a>
            </div>
          </div>

          {/* Right: Product Mock */}
          <div className="relative">
            <div className="bg-card rounded-2xl border border-border shadow-2xl shadow-primary/5 p-6 lg:p-8">
              {/* Mock Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Estoque Central</p>
                    <p className="text-xs text-muted-foreground">Atualizado em tempo real</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Sincronizado
                </span>
              </div>

              {/* Mock Cards */}
              <div className="space-y-3">
                {[
                  { channel: "PDV", status: "Confirmado", qty: 12, color: "bg-emerald-500" },
                  { channel: "E-commerce", status: "Reservado", qty: 8, color: "bg-amber-500" },
                  { channel: "WhatsApp", status: "Confirmado", qty: 5, color: "bg-emerald-500" },
                ].map((item) => (
                  <div
                    key={item.channel}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="font-medium text-foreground text-sm">{item.channel}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">{item.status}</span>
                      <span className="font-semibold text-foreground text-sm">{item.qty} un</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mock Footer */}
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estoque dispon�vel</span>
                  <span className="text-2xl font-bold text-foreground">127 un</span>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -z-10 -top-4 -right-4 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
            <div className="absolute -z-10 -bottom-8 -left-8 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          </div>
        </div>
      </Container>
    </section>
  )
}
