/**
 * Heuristicas para identificar "necessidade consultiva" - quando o
 * cliente quer "algo" / "um presente" / "sobremesa" generica sem
 * especificar produto. Usado pra rotear esses casos para o fluxo
 * consultivo de vendas em vez do fluxo transacional.
 */

const IMPLICIT_SINGULAR_ORDER_RE =
  /^(quero|me ve|me manda|manda|separa|traz|coloca|bota|preciso|vou querer|gostaria de)\s+(um|uma)\b/;

/**
 * True se a mensagem comeca com verbo de pedido + "um/uma" - indica
 * intent singular ("quero um brigadeiro", "manda uma sobremesa").
 * Usado em combinacao com isAbstractConsultativeNeed.
 */
export function hasImplicitSingularOrderLead(
  normalizedMessage: string,
): boolean {
  return IMPLICIT_SINGULAR_ORDER_RE.test(normalizedMessage);
}

/**
 * Palavras "abstratas" - quando a mensagem so contem palavras desta
 * lista, eh sinal de necessidade consultiva, nao pedido especifico.
 */
export const ABSTRACT_NEED_WORDS: ReadonlySet<string> = new Set([
  'algo',
  'opcao',
  'opcoes',
  'sobremesa',
  'sobremesas',
  'cremosa',
  'cremoso',
  'colher',
  'doce',
  'doces',
  'docinho',
  'docinhos',
  'brigadeiro',
  'brigadeiros',
  'beijinho',
  'beijinhos',
  'presente',
  'presentear',
  'mimo',
  'lembranca',
  'lembrancinha',
  'chocolate',
  'chocolatudo',
  'depois',
  'do',
  'da',
  'pra',
  'para',
  'almoco',
  'jantar',
  'cafe',
  'tarde',
  'manha',
  'visita',
  'familia',
  'gente',
  'agradecer',
]);

/**
 * Tokens que indicam produto especifico. Se a mensagem contem qualquer
 * um destes, NAO eh "abstrato".
 */
export const SPECIFIC_PRODUCT_TOKENS: ReadonlySet<string> = new Set([
  'banoffe',
  'brownie',
  'bala',
  'pudim',
  'morango',
  'uva',
  'prestigio',
  'maracuja',
  'nutella',
  'acai',
  'torta',
  'supreme',
  'pote',
  'caixa',
  'kit',
  'cestinha',
  'individual',
]);

/**
 * True se a mensagem normalizada eh "abstrata" - so contem palavras de
 * ABSTRACT_NEED_WORDS e nao contem nenhuma de SPECIFIC_PRODUCT_TOKENS.
 */
export function isAbstractConsultativeNeed(normalizedProduct: string): boolean {
  const words = normalizedProduct
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) {
    return false;
  }

  if (words.some((word) => SPECIFIC_PRODUCT_TOKENS.has(word))) {
    return false;
  }

  return words.every((word) => ABSTRACT_NEED_WORDS.has(word));
}
