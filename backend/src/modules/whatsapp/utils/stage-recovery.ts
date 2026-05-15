/**
 * Mensagens de "recovery" quando o usuario responde fora da etapa esperada
 * (ex: tenta enviar endereco depois que o pedido ja entrou em pagamento).
 *
 * Funcoes puras - sem this. Recebem o tracking URL ja pronto (a service
 * resolve FRONTEND_URL via ConfigService e passa).
 */

import { Pedido, PedidoStatus } from '../../../database/entities/Pedido.entity';
import { ConversationState } from '../types/whatsapp.types';
import {
  getNextStepSummary,
  getStatusLabel,
} from './order-formatters';

export type StageRecoveryKind =
  | 'phone'
  | 'address'
  | 'delivery'
  | 'confirmation'
  | 'notes'
  | 'name';

const STAGE_RECOVERY_LABELS: Record<StageRecoveryKind, string> = {
  phone: 'telefone',
  address: 'endereco',
  delivery: 'forma de recebimento',
  confirmation: 'confirmacao final',
  notes: 'observacao',
  name: 'nome',
};

/**
 * Label em pt-BR para o tipo de "stage recovery" - usado em frases tipo
 * "Nao preciso mais de <label>".
 */
export function getStageRecoveryLabel(kind: StageRecoveryKind): string {
  return STAGE_RECOVERY_LABELS[kind];
}

/**
 * Mensagem quando o pedido ja esta em 'waiting_payment' e o usuario envia
 * algo que parece tentativa de re-cadastrar campos antigos.
 */
export function buildWaitingPaymentStageRecoveryMessage(
  pedido: Pedido | null,
  kind: StageRecoveryKind,
  trackingUrl?: string,
): string {
  const label = getStageRecoveryLabel(kind);
  const intro =
    kind === 'confirmation'
      ? 'A revisao final ja foi registrada e o pedido entrou na etapa de pagamento.'
      : `Nao preciso mais de ${label} para este pedido.`;

  return [
    intro,
    pedido ? '' : 'Seu pedido ja esta aguardando a escolha do pagamento.',
    pedido ? `Pedido: *${pedido.order_no}*` : '',
    pedido ? `Status atual: *${getStatusLabel(pedido.status)}*` : '',
    '',
    'Para seguir agora, responda com a forma de pagamento:',
    '- pix',
    '- dinheiro',
    pedido && trackingUrl ? `Acompanhamento completo: ${trackingUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Mensagem quando o pedido ja foi confirmado/concluido e usuario tenta
 * re-cadastrar dados.
 */
export function buildClosedStageRecoveryMessage(
  pedido: Pedido | null,
  currentState: ConversationState,
  kind: StageRecoveryKind,
  trackingUrl?: string,
): string {
  const label = getStageRecoveryLabel(kind);
  const intro =
    currentState === 'order_completed'
      ? `O ${label} ja ficou registrado antes e esse pedido concluiu a jornada.`
      : `O ${label} ja ficou registrado antes e esse pedido ja esta em andamento.`;

  return [
    pedido ? `Pedido: *${pedido.order_no}*` : 'Esse pedido ja passou da etapa de cadastro.',
    pedido ? `Status atual: *${getStatusLabel(pedido.status)}*` : '',
    intro,
    pedido
      ? getNextStepSummary(pedido, pedido.status)
      : 'Se quiser, me envie "status do pedido" para acompanhar.',
    '',
    pedido && trackingUrl
      ? `Acompanhamento completo: ${trackingUrl}`
      : 'Envie "status do pedido" para acompanhar.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Mensagem quando o usuario tenta gerar nova cobranca para um pedido que
 * ja saiu de "waiting_payment" - bloqueia duplicidade.
 */
export function buildPaymentStageGuardMessage(
  pedido: Pedido,
  trackingUrl: string,
): string {
  if (pedido.status === PedidoStatus.CANCELADO) {
    return [
      `O pedido *${pedido.order_no}* esta cancelado, entao eu nao vou gerar uma nova cobranca por seguranca.`,
      'Se quiser, eu monto um novo pedido do zero por aqui.',
      `Acompanhamento completo: ${trackingUrl}`,
    ].join('\n');
  }

  return [
    `O pagamento do pedido *${pedido.order_no}* nao precisa ser escolhido novamente.`,
    `Status atual: *${getStatusLabel(pedido.status)}*`,
    getNextStepSummary(pedido, pedido.status),
    '',
    `Acompanhamento completo: ${trackingUrl}`,
  ].join('\n');
}
