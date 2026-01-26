import { Container } from "./Container"

export function Explainer() {
  return (
    <section id="explicacao" className="section-padding-compact relative">
      <Container>
        <div className="max-w-4xl mx-auto section-header-gap text-center">
          <div className="badge-base mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>Explicação em 1 minuto</span>
          </div>
          <h2 className="mb-5">
            <span className="text-foreground">
              Sua loja física, seu site e seu WhatsApp.
            </span>
            <span className="block text-muted-foreground mt-1">
              Tudo em um só estoque.
            </span>
          </h2>
          <p className="body-text-lg mx-auto">
            A UCM é uma plataforma de comércio unificado que conecta seus principais
            canais de venda em um ecossistema único. Centralizamos seu PDV, e-commerce
            e WhatsApp para que sua operação funcione em total sincronia.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="card-base card-interactive p-6 lg:p-7">
            <h3 className="card-title mb-4">O que resolvemos para o seu negócio</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">Fim das vendas duplicadas:</span>{" "}
                O estoque é um só. Se vendeu no balcão, o produto sai do site e do
                WhatsApp na mesma hora.
              </li>
              <li>
                <span className="text-foreground font-medium">Gestão sem furos:</span>{" "}
                Elimine o erro humano e a necessidade de conferências manuais constantes.
              </li>
              <li>
                <span className="text-foreground font-medium">Visão clara do estoque:</span>{" "}
                Controle real do que está disponível, em tempo real, sem ruído.
              </li>
            </ul>
          </div>

          <div className="card-base card-interactive p-6 lg:p-7">
            <h3 className="card-title mb-4">O diferencial: WhatsApp com reserva automática</h3>
            <p className="small-text mb-4">
              O atendimento pelo WhatsApp na UCM não é apenas mensagem automática. É
              um canal de venda inteligente conectado ao seu inventário.
            </p>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">Consulta em tempo real:</span>{" "}
                O sistema informa a disponibilidade real sem você intervir.
              </li>
              <li>
                <span className="text-foreground font-medium">Reserva imediata:</span>{" "}
                Quando o cliente inicia o pedido, o item é travado no sistema.
              </li>
              <li>
                <span className="text-foreground font-medium">Agilidade e segurança:</span>{" "}
                Atendimento rápido e a garantia de não vender o que não pode entregar.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 lg:mt-10 grid lg:grid-cols-2 gap-6 lg:gap-8">
          <div className="card-elevated p-6 lg:p-7">
            <h3 className="card-title mb-4">Como funciona na prática</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">Sincronização instantânea:</span>{" "}
                Vendeu em um canal? Todos os outros são atualizados no mesmo segundo.
              </li>
              <li>
                <span className="text-foreground font-medium">Fluxo de reserva:</span>{" "}
                Proteção automática contra furos de estoque durante a compra.
              </li>
              <li>
                <span className="text-foreground font-medium">Operação unificada:</span>{" "}
                Controle pedidos, estoque e clientes de todos os canais em uma única tela.
              </li>
            </ul>
          </div>

          <div className="card-elevated p-6 lg:p-7">
            <h3 className="card-title mb-4">Por que escolher a UCM?</h3>
            <p className="small-text">
              Desenvolvemos tecnologia para simplificar o que é complexo. Enquanto
              você foca em vender e atender bem, a UCM garante que os bastidores da
              operação estejam sempre alinhados, sem erros e sem retrabalho.
            </p>
          </div>
        </div>
      </Container>
    </section>
  )
}
