import Link from "next/link"
import { Container } from "@/components/landing/Container"

export const metadata = {
  title: "Termos de Uso | GTSoftHub",
  description: "Termos e condições de uso da plataforma GTSoftHub.",
}

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Container className="py-20 max-w-3xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Voltar para a home
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Termos de Uso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última atualização: 19 de maio de 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-medium text-foreground mb-2">1. Aceitação</h2>
            <p>
              Ao acessar ou utilizar a plataforma GTSoftHub, você concorda com estes Termos de Uso.
              Se não concordar, não utilize o serviço. O uso continuado após alterações constitui
              aceitação dos termos revisados.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">2. Descrição do serviço</h2>
            <p>
              GTSoftHub é uma plataforma SaaS de comércio unificado que permite a lojistas
              gerenciar vendas via WhatsApp, PDV e loja online com estoque integrado,
              pagamentos e logística em um único painel.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">3. Cadastro e conta</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Você deve fornecer informações verdadeiras e mantê-las atualizadas.</li>
              <li>Cada empresa (tenant) possui um administrador responsável.</li>
              <li>Você é responsável pela segurança de suas credenciais de acesso.</li>
              <li>Notifique-nos imediatamente sobre uso não autorizado da sua conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">4. Uso aceitável</h2>
            <p>Você concorda em não:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Utilizar o serviço para atividades ilegais ou fraudulentas.</li>
              <li>Enviar spam ou mensagens não solicitadas via WhatsApp.</li>
              <li>Tentar acessar dados de outros tenants.</li>
              <li>Realizar engenharia reversa ou interferir na infraestrutura.</li>
              <li>Revender o acesso sem autorização prévia por escrito.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">5. Pagamentos e planos</h2>
            <p>
              Os valores e condições de cada plano estão disponíveis na página de preços.
              Cobranças são recorrentes e podem ser canceladas a qualquer momento, com
              efeito ao final do ciclo vigente. Não há reembolso proporcional.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">6. Propriedade intelectual</h2>
            <p>
              A plataforma, marca, código e documentação são propriedade exclusiva da GTSoftHub.
              Os dados inseridos pelo lojista permanecem de propriedade do lojista. Concedemos
              licença limitada, não exclusiva e revogável para uso da plataforma conforme o plano contratado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">7. Disponibilidade e SLA</h2>
            <p>
              Nos esforçamos para manter disponibilidade de 99,5% mensal. Manutenções
              programadas serão comunicadas com 48h de antecedência. Não nos responsabilizamos
              por indisponibilidades causadas por terceiros (provedores de pagamento, operadoras).
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">8. Limitação de responsabilidade</h2>
            <p>
              Na máxima extensão permitida por lei, a GTSoftHub não será responsável por
              danos indiretos, incidentais ou consequenciais. Nossa responsabilidade total
              está limitada ao valor pago nos últimos 12 meses.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">9. Rescisão</h2>
            <p>
              Qualquer parte pode rescindir o contrato com 30 dias de aviso. Podemos
              suspender imediatamente em caso de violação destes termos. Após rescisão,
              seus dados ficam disponíveis para exportação por 30 dias.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">10. Privacidade</h2>
            <p>
              O tratamento de dados pessoais é regido pela nossa{" "}
              <Link href="/info/privacidade" className="underline hover:text-foreground">
                Política de Privacidade
              </Link>, que é parte integrante destes termos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-foreground mb-2">11. Foro e legislação</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil.
              Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer
              controvérsias, com renúncia a qualquer outro por mais privilegiado que seja.
            </p>
          </section>
        </div>
      </Container>
    </div>
  )
}
