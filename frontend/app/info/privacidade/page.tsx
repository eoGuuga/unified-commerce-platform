import Link from "next/link"
import { Container } from "@/components/landing/Container"

export const metadata = {
  title: "Política de Privacidade | GTSoftHub",
  description: "Como coletamos, usamos e protegemos seus dados pessoais.",
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Container className="py-20 max-w-3xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Voltar para a home
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: 19 de maio de 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-medium text-foreground mb-2">1. Controlador dos dados</h2>
            <p>
              GTSoftHub (&ldquo;nós&rdquo;, &ldquo;nosso&rdquo;) é o controlador dos dados pessoais
              coletados por meio da plataforma. Contato do encarregado (DPO):{" "}
              <a href="mailto:privacidade@gtsofthub.com.br" className="underline hover:text-foreground">
                privacidade@gtsofthub.com.br
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">2. Dados que coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados de cadastro: nome, e-mail, telefone, CNPJ/CPF do lojista.</li>
              <li>Dados de pedidos: endereço de entrega, itens, valores, forma de pagamento.</li>
              <li>Dados de navegação: IP, user-agent, páginas visitadas (via cookies analíticos).</li>
              <li>Mensagens de WhatsApp: conteúdo das conversas para processamento de pedidos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">3. Finalidades do tratamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Execução do contrato de prestação de serviço SaaS (Art. 7º, V da LGPD).</li>
              <li>Processamento e entrega de pedidos.</li>
              <li>Comunicação transacional (confirmações, atualizações de status).</li>
              <li>Melhoria do serviço e análise agregada de uso.</li>
              <li>Cumprimento de obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">4. Compartilhamento</h2>
            <p>
              Compartilhamos dados apenas com: processadores de pagamento (Mercado Pago),
              provedores de mensageria (Twilio/Evolution API), e serviços de infraestrutura
              (hospedagem). Não vendemos dados pessoais a terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">5. Retenção</h2>
            <p>
              Dados de conta são mantidos enquanto o contrato estiver ativo. Após cancelamento,
              retemos por 5 anos para cumprimento de obrigações fiscais. Dados de navegação
              são anonimizados após 90 dias.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">6. Seus direitos (LGPD Art. 18)</h2>
            <p>Você pode exercer os seguintes direitos:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Confirmação e acesso aos seus dados.</li>
              <li>Correção de dados incompletos ou desatualizados.</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários.</li>
              <li>Portabilidade dos dados a outro fornecedor.</li>
              <li>Revogação do consentimento.</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, envie e-mail para{" "}
              <a href="mailto:privacidade@gtsofthub.com.br" className="underline hover:text-foreground">
                privacidade@gtsofthub.com.br
              </a>{" "}
              ou utilize o endpoint <code className="text-xs bg-muted px-1 py-0.5 rounded">
              POST /api/v1/lgpd/solicitacao</code>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">7. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais: criptografia em trânsito (TLS 1.3),
              isolamento de dados por tenant (Row-Level Security), backups criptografados,
              controle de acesso baseado em papéis, e monitoramento de acessos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">8. Cookies</h2>
            <p>
              Utilizamos cookies essenciais (sessão, CSRF) e analíticos (anonimizados).
              Veja nossa <Link href="/info/cookies" className="underline hover:text-foreground">
              Política de Cookies</Link> para detalhes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">9. Alterações</h2>
            <p>
              Esta política pode ser atualizada periodicamente. Notificaremos alterações
              materiais por e-mail ou aviso na plataforma com 30 dias de antecedência.
            </p>
          </section>
        </div>
      </Container>
    </div>
  )
}
