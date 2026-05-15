/**
 * Listas de frases para detectores de intent pos-pedido:
 *   - prova de pagamento ("ja paguei", "pix caiu", ...)
 *   - cortesia ("obrigado", "valeu", "tmj")
 *   - mudanca de pedido ("trocar endereco", "muda pagamento", ...)
 *   - verbos de mudanca (generico)
 *   - alvos de mudanca (generico)
 *
 * Frases normalizadas (esperam input ja passado por
 * messageIntelligenceService.normalizeText antes do matching).
 */

export const PAYMENT_PROOF_PHRASES: ReadonlyArray<string> = [
  'ja paguei',
  'paguei',
  'ja fiz o pix',
  'fiz o pix',
  'ja fiz pix',
  'pix pago',
  'pagamento feito',
  'pagamento concluido',
  'ja transferi',
  'transferi',
  'mandei comprovante',
  'enviei comprovante',
  'ja mandei comprovante',
  'comprovante enviado',
  'ta pago',
  'pix caiu',
  'pix caiu ai',
  'enviei o pix',
  'paguei ja',
  'comprovante ta ai',
  'passei no cartao',
];

export const POST_ORDER_COURTESY_PHRASES: ReadonlyArray<string> = [
  'obrigado',
  'obrigada',
  'obg',
  'valeu',
  'vlw',
  'fechou',
  'show',
  'beleza',
  'blz',
  'tranquilo',
  'perfeito',
  'certinho',
  'tamo junto',
  'top',
  'tmj',
  'brigado',
  'obrigadao',
  'deus abencoe',
  'deus te abencoe',
];

/**
 * Frases explicitas que indicam tentativa de mudar algo no pedido apos
 * a etapa de criacao (mudar endereco, trocar pagamento, etc).
 */
export const POST_ORDER_EXPLICIT_CHANGE_PHRASES: ReadonlyArray<string> = [
  'muda meu endereco',
  'mudar endereco',
  'trocar endereco',
  'troca meu endereco',
  'alterar endereco',
  'corrigir endereco',
  'novo endereco',
  'muda para retirada',
  'muda pra retirada',
  'troca para retirada',
  'troca pra retirada',
  'muda para entrega',
  'muda pra entrega',
  'troca para entrega',
  'troca pra entrega',
  'mudar forma de pagamento',
  'trocar forma de pagamento',
  'trocar pagamento',
  'muda pagamento',
  'alterar pagamento',
  'acrescenta',
  'acrescentar',
  'adiciona',
  'adicionar mais',
  'remover item',
  'tirar item',
  'trocar item',
  'mudar item',
  'alterar pedido',
  'mudar pedido',
  'trocar pedido',
  'corrigir pedido',
];

/**
 * Verbos de "mudar/trocar/alterar" genericos - usados em combinacao com
 * POST_ORDER_CHANGE_TARGETS para detectar tentativas implicitas de mudanca.
 */
export const POST_ORDER_CHANGE_VERBS: ReadonlyArray<string> = [
  'mudar',
  'trocar',
  'alterar',
  'corrigir',
  'acrescentar',
  'adicionar',
  'remover',
  'tirar',
  'ajustar',
];

/**
 * Alvos de mudanca - "o que" o cliente quer mudar.
 */
export const POST_ORDER_CHANGE_TARGETS: ReadonlyArray<string> = [
  'endereco',
  'entrega',
  'retirada',
  'pagamento',
  'pix',
  'credito',
  'debito',
  'cartao',
  'item',
  'produto',
  'pedido',
  'sabor',
];
