import Link from "next/link"
import { Container } from "@/components/landing/Container"

export const metadata = {
  title: "Política de Cookies | GTSoftHub",
  description: "Como utilizamos cookies e tecnologias similares.",
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Container className="py-20 max-w-3xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Voltar para a home
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Política de Cookies
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: 19 de maio de 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-medium text-foreground mb-2">1. O que são cookies</h2>
            <p>
              Cookies são pequenos arquivos de texto armazenados no seu navegador quando
              você visita um site. Eles permitem que o site reconheça seu dispositivo e
              lembre preferências entre visitas.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">2. Cookies que utilizamos</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium text-foreground">Cookie</th>
                    <th className="py-2 pr-4 font-medium text-foreground">Tipo</th>
                    <th className="py-2 pr-4 font-medium text-foreground">Finalidade</th>
                    <th className="py-2 font-medium text-foreground">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr>
                    <td className="py-2 pr-4"><code className="text-xs">session_token</code></td>
                    <td className="py-2 pr-4">Essencial</td>
                    <td className="py-2 pr-4">Autenticação do usuário</td>
                    <td className="py-2">Sessão</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code className="text-xs">csrf_token</code></td>
                    <td className="py-2 pr-4">Essencial</td>
                    <td className="py-2 pr-4">Proteção contra CSRF</td>
                    <td className="py-2">Sessão</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code className="text-xs">theme</code></td>
                    <td className="py-2 pr-4">Funcional</td>
                    <td className="py-2 pr-4">Preferência de tema (claro/escuro)</td>
                    <td className="py-2">1 ano</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code className="text-xs">_analytics</code></td>
                    <td className="py-2 pr-4">Analítico</td>
                    <td className="py-2 pr-4">Métricas de uso agregadas (anonimizado)</td>
                    <td className="py-2">90 dias</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">3. Cookies essenciais</h2>
            <p>
              São necessários para o funcionamento básico da plataforma (autenticação,
              segurança). Não podem ser desativados sem comprometer o uso do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">4. Cookies analíticos</h2>
            <p>
              Coletam informações anonimizadas sobre como os visitantes usam a plataforma.
              Não identificam usuários individualmente. Utilizamos esses dados apenas para
              melhorar a experiência do produto.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">5. Como gerenciar cookies</h2>
            <p>
              Você pode configurar seu navegador para bloquear ou alertar sobre cookies.
              Note que desativar cookies essenciais impedirá o uso de funcionalidades
              autenticadas da plataforma.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Chrome: Configurações &gt; Privacidade e segurança &gt; Cookies</li>
              <li>Firefox: Configurações &gt; Privacidade &gt; Cookies</li>
              <li>Safari: Preferências &gt; Privacidade</li>
              <li>Edge: Configurações &gt; Cookies e permissões do site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">6. Mais informações</h2>
            <p>
              Para dúvidas sobre cookies, consulte nossa{" "}
              <Link href="/info/privacidade" className="underline hover:text-foreground">
                Política de Privacidade
              </Link>{" "}
              ou entre em contato pelo e-mail{" "}
              <a href="mailto:privacidade@gtsofthub.com.br" className="underline hover:text-foreground">
                privacidade@gtsofthub.com.br
              </a>.
            </p>
          </section>
        </div>
      </Container>
    </div>
  )
}
