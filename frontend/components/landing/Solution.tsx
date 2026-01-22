import { Container } from "./Container"

export function Solution() {
  return (
    <section id="solucao" className="py-20 lg:py-32 bg-muted/30">
      <Container>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            Uma �nica fonte da verdade
          </h2>
          <p className="text-lg text-muted-foreground">
            Backend centralizado que garante consist�ncia absoluta do estoque em tempo real.
          </p>
        </div>

        {/* Architecture Diagram */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Central Hub */}
            <div className="flex justify-center mb-12">
              <div className="relative">
                <div className="w-48 h-48 lg:w-56 lg:h-56 rounded-full bg-primary/5 border-2 border-primary/20 flex items-center justify-center">
                  <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-primary flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-foreground text-sm">Backend Central</p>
                      <p className="text-xs text-muted-foreground">UCM</p>
                    </div>
                  </div>
                </div>
                {/* Pulse animation */}
                <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping opacity-20" />
              </div>
            </div>

            {/* Connection Lines and Channels */}
            <div className="grid grid-cols-3 gap-4 lg:gap-8">
              {[
                {
                  name: "PDV",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                    </svg>
                  ),
                  description: "Ponto de venda f�sico",
                },
                {
                  name: "E-commerce",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                  ),
                  description: "Loja virtual",
                },
                {
                  name: "WhatsApp",
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  ),
                  description: "Vendas por mensagem",
                },
              ].map((channel) => (
                <div key={channel.name} className="text-center">
                  {/* Connection line */}
                  <div className="h-8 w-px bg-border mx-auto mb-4 relative">
                    <div className="absolute inset-0 w-px bg-accent animate-pulse" />
                  </div>
                  
                  {/* Channel card */}
                  <div className="p-6 rounded-2xl bg-card border border-border hover:border-accent/30 hover:shadow-lg transition-all duration-300">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      {channel.icon}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{channel.name}</h3>
                    <p className="text-sm text-muted-foreground">{channel.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
