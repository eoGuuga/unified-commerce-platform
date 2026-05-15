/**
 * Phrase lists para detectores de:
 *   - soft-stop ("nao quero mais", "desisti", "deixa pra la")
 *   - discount question ("tem desconto", "rola promo")
 *
 * Constantes puras. O matching continua no service.
 */

export const COLLECTION_SOFT_STOP_PHRASES: ReadonlyArray<string> = [
  'nao quero',
  'nao quero mais',
  'nao vou querer',
  'nao vou mais querer',
  'quero mais n',
  'quero mais nao',
  'desisti',
  'deixa pra la',
  'deixa para la',
  'tira isso',
  'para com isso',
  'pare com isso',
];

export const DISCOUNT_QUESTION_PHRASES: ReadonlyArray<string> = [
  'tem desconto',
  'tem algum desconto',
  'rola desconto',
  'consegue desconto',
  'tem promocao',
  'tem promo',
  'faz um preco melhor',
  'faz melhor no preco',
  'tem abatimento',
];
