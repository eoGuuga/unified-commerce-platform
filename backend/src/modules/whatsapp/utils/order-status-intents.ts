/**
 * Listas de frases para detectores de intent relacionadas a status de
 * pedido / acompanhamento / reabertura.
 *
 * Constantes puras. Os detectores que consomem essas listas continuam no
 * servico porque dependem da messageIntelligenceService para normalizar
 * e fazer matching.
 */

/**
 * Frases especificas que indicam pergunta direta sobre o status do pedido.
 */
export const ORDER_STATUS_QUERY_PHRASES: ReadonlyArray<string> = [
  'meu pedido',
  'status do pedido',
  'status pedido',
  'acompanhar pedido',
  'acompanha pedido',
  'rastrear pedido',
  'rastreia pedido',
  'cade meu pedido',
  'cade o pedido',
  'onde ta meu pedido',
  'onde ta o pedido',
  'aonde ta meu pedido',
  'como ta meu pedido',
  'qual status do pedido',
  'quando chega meu pedido',
  'quando chega minha entrega',
  'onde ta minha encomenda',
  'cade minha encomenda',
  'cade o motoboy',
  'onde ta o motoboy',
  'cade o entregador',
  'onde ta o entregador',
  'ja saiu com o motoboy',
  'ja saiu com o entregador',
  'andamento do pedido',
  'atualizacao do pedido',
  'atualizacao da entrega',
  'pedido saiu',
  'ja saiu meu pedido',
  'saiu para entrega',
  'chega que horas',
];

/**
 * Sinais genericos de "status/acompanhar" - usados em combinacao com
 * ORDER_STATUS_KEYWORDS para detectar perguntas mais flexiveis.
 */
export const ORDER_STATUS_SIGNALS: ReadonlyArray<string> = [
  'status',
  'acompanhar',
  'acompanha',
  'rastrear',
  'rastreia',
  'cade',
  'onde ta',
  'aonde ta',
  'como ta',
  'quando chega',
  'demora',
  'andamento',
  'atualizacao',
  'ja saiu',
  'saiu',
];

/**
 * Palavras-chave de pedido. Usadas para validar que a pergunta eh sobre
 * pedido (e nao outra coisa).
 */
export const ORDER_KEYWORDS: ReadonlyArray<string> = [
  'pedido',
  'encomenda',
  'entrega',
];

/**
 * Frases que indicam pergunta sobre status quando ha contexto de pedido
 * ativo (mais permissivas - aceitam consultas sem dizer "pedido"
 * explicitamente, porque o cliente esta no meio da conversa).
 */
export const ACTIVE_CONTEXT_STATUS_PHRASES: ReadonlyArray<string> = [
  'cade',
  'onde ta',
  'aonde ta',
  'como ta',
  'quando chega',
  'demora',
  'ja saiu',
  'saiu',
  'motoboy',
  'entregador',
  'chega que horas',
  'ta pronto',
  'ficou pronto',
  'status',
];

/**
 * Frases para detectar intent de "reabrir / retomar pedido cancelado".
 */
export const REOPEN_INTENT_PHRASES: ReadonlyArray<string> = [
  'reabri pedid',
  'reabri pedido',
  'reabrir pedid',
  'reabre pedid',
  'continuar pedid',
  'retomar pedid',
];
