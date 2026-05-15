/**
 * Formatadores de pedido / cliente para mensagens do bot WhatsApp.
 * Funcoes puras - sem dependencias do servico ou do banco.
 *
 * Extraidas de whatsapp.service.ts para reduzir o monolito e permitir
 * testes unitarios isolados.
 */

import { Pedido, PedidoStatus } from '../../../database/entities/Pedido.entity';

/**
 * Formata um valor numerico no estilo BRL para WhatsApp (sem simbolo R$,
 * com virgula como decimal). A funcao chamadora prefixa "R$ " se quiser.
 *
 * Ex.: formatCurrencyBR(99.9) -> "99,90".
 */
export function formatCurrencyBR(value: number): string {
  return Number(value || 0)
    .toFixed(2)
    .replace('.', ',');
}

/**
 * Saudacao inicial respeitando o nome do cliente quando disponivel.
 */
export function getGreetingLine(customerName?: string | null): string {
  return customerName?.trim() ? `Ola, ${customerName.trim()}!` : 'Ola!';
}

/**
 * Label amigavel para o status do pedido.
 */
export function getStatusLabel(status: PedidoStatus): string {
  const labels: Record<PedidoStatus, string> = {
    [PedidoStatus.PENDENTE_PAGAMENTO]: 'Pagamento pendente',
    [PedidoStatus.CONFIRMADO]: 'Confirmado',
    [PedidoStatus.EM_PRODUCAO]: 'Em preparacao',
    [PedidoStatus.PRONTO]: 'Pronto',
    [PedidoStatus.EM_TRANSITO]: 'Em transito',
    [PedidoStatus.ENTREGUE]: 'Entregue',
    [PedidoStatus.CANCELADO]: 'Cancelado',
  };

  return labels[status] || status;
}

/**
 * Label amigavel para o tipo de entrega.
 */
export function getDeliveryTypeLabel(deliveryType?: string | null): string {
  return deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
}

/**
 * Texto explicativo do proximo passo da jornada de acordo com o status atual.
 */
export function getNextStepSummary(
  pedido: Pedido,
  status: PedidoStatus,
): string {
  switch (status) {
    case PedidoStatus.PENDENTE_PAGAMENTO:
      return pedido.delivery_type === 'pickup'
        ? 'Conclua o pagamento para liberar a preparacao e acompanhar quando a retirada estiver pronta.'
        : 'Conclua o pagamento para liberar a preparacao e acompanhar a entrega sem perder contexto.';
    case PedidoStatus.CONFIRMADO:
      return pedido.delivery_type === 'pickup'
        ? 'Agora a equipe segue para deixar tudo pronto para uma retirada rapida.'
        : 'Agora a equipe segue para a preparacao e depois para a expedicao do pedido.';
    case PedidoStatus.EM_PRODUCAO:
      return pedido.delivery_type === 'pickup'
        ? 'A proxima virada importante sera quando o pedido estiver pronto para retirada.'
        : 'A proxima virada importante sera quando o pedido estiver pronto para envio.';
    case PedidoStatus.PRONTO:
      return pedido.delivery_type === 'pickup'
        ? 'Tenha o codigo do pedido em maos para acelerar a retirada.'
        : 'O pedido concluiu a preparacao e aguarda a saida para entrega.';
    case PedidoStatus.EM_TRANSITO:
      return 'O pedido ja saiu e agora caminha para a ultima etapa da jornada.';
    case PedidoStatus.ENTREGUE:
      return 'Esse acompanhamento continua valendo como comprovante e referencia da compra.';
    case PedidoStatus.CANCELADO:
      return 'Se precisar retomar a compra, o codigo do pedido ajuda a equipe a continuar sem retrabalho.';
  }
}

/**
 * Sugestao de proxima acao do cliente conforme o status do pedido.
 * Retorna null quando nao houver acao recomendada.
 */
export function getOrderStatusAction(
  _pedido: Pedido,
  status: PedidoStatus,
): string | null {
  switch (status) {
    case PedidoStatus.PENDENTE_PAGAMENTO:
      return 'Se quiser concluir agora aqui no WhatsApp, responda: "pix" ou "dinheiro".';
    case PedidoStatus.CONFIRMADO:
    case PedidoStatus.EM_PRODUCAO:
    case PedidoStatus.PRONTO:
    case PedidoStatus.EM_TRANSITO:
      return 'Se quiser voltar a acompanhar por aqui depois, basta enviar: "status do pedido".';
    case PedidoStatus.ENTREGUE:
      return 'Se quiser repetir a compra, envie: "repetir pedido".';
    case PedidoStatus.CANCELADO:
      return 'Se quiser retomar a compra, envie: "reabrir pedido" ou me diga o produto que deseja.';
    default:
      return null;
  }
}

/**
 * Preview dos primeiros 4 itens do pedido (com contador de "mais N item(ns)"
 * para o restante). Retorna string vazia quando nao houver itens.
 */
export function buildOrderItemsPreview(pedido: Pedido): string {
  const items = (pedido.itens || []).slice(0, 4).map((item: {
    quantity: number;
    produto?: { name: string } | null;
    produto_id?: string;
  }) => `- ${item.quantity}x ${item.produto?.name || item.produto_id || 'Produto'}`);

  if (!items.length) {
    return '';
  }

  const hiddenItems = Math.max(0, (pedido.itens || []).length - items.length);
  return [
    'Itens:',
    ...items,
    hiddenItems > 0 ? `- mais ${hiddenItems} item(ns)` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Prompts fixos do bot para coleta de dados do cliente.
 */
export const PHONE_PROMPT =
  '📱 *Para finalizar, preciso do seu telefone de contato:*\n' +
  'Exemplo: (11) 98765-4321 ou 11987654321';

export const NOTES_PROMPT =
  '📝 *Quer deixar alguma observação?*\n' +
  'Ex.: "Sem açúcar", "Entregar na portaria"\n\n' +
  '💬 Se não tiver, digite *"sem"*.';
