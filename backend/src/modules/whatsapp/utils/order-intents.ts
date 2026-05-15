/**
 * Listas de phrases para detectores de intent de pedido.
 *   - REPEAT_ORDER_PHRASES: cliente quer repetir um pedido anterior.
 *   - ORDER_INTENT_PHRASES (palavrasPedido): verbos/expressoes que sinalizam
 *     intencao de fazer pedido, em pt-BR coloquial.
 *
 * Constantes puras. O matching propriamente dito continua no service
 * porque depende de normalizeForSearch + messageIntelligenceService.
 */

/**
 * Frases que indicam "repetir pedido anterior".
 */
export const REPEAT_ORDER_PHRASES: ReadonlyArray<string> = [
  'repetir pedido',
  'pedido repetido',
  'repetir meu pedido',
  'refazer pedido',
];

/**
 * Vocabulario de "querer/comprar/pedir" usado para detectar intent de
 * fazer pedido. Sao expressoes pt-BR coloquiais. Ainda dependem de
 * extractOrderInfo conseguir extrair um produto/quantidade pra confirmar
 * a intent.
 */
export const ORDER_INTENT_PHRASES: ReadonlyArray<string> = [
  'quero',
  'preciso',
  'comprar',
  'pedir',
  'vou querer',
  'gostaria de',
  'desejo',
  'vou comprar',
  'preciso de',
  'queria',
  'ia querer',
  'me manda',
  'manda',
  'manda ai',
  'manda pra mim',
  'me ve',
  'separa',
  'separa pra mim',
  'separar',
  'separar pra mim',
  'separar para mim',
  'pode ser',
  'faz',
  'me faz',
  'faz pra mim',
  'bota',
  'coloca',
  'traz',
  'traz pra mim',
  'pode me enviar',
  'tem como',
  'dá pra',
  'dá pra fazer',
  'dá pra me enviar',
  'seria possível',
  'poderia',
  'pode me mandar',
  'me envia',
  'envia',
  'vou pedir',
  'quero comprar',
  'preciso comprar',
  'quero pedir',
  'quero levar',
  'quero pegar',
  'preciso pedir',
  'quero encomendar',
  'preciso encomendar',
  'quero fazer pedido',
  'preciso fazer pedido',
  'quero fazer um pedido',
  'preciso fazer um pedido',
  'quero fazer uma encomenda',
  'preciso fazer uma encomenda',
  'quero fazer encomenda',
  'preciso fazer encomenda',
  'quero fazer',
  'preciso fazer',
];
