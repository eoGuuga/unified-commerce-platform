/**
 * Detectores de intent "direta" - perguntas/comandos curtos e nao
 * ambiguos do cliente (catalogo, preco, estoque, horario, ajuda,
 * saudacao). Tambem expoe BARE_ORDER_PHRASES (frases "pelada" de
 * intent de pedido que ainda nao tem produto/quantidade).
 *
 * Funcoes recebem o normalizador como parametro pra evitar acoplamento
 * com messageIntelligenceService.
 */

import { TextNormalizer } from './address-helpers';

/**
 * Set de frases que indicam intent de pedido mas sem detalhamento
 * (cliente disse apenas "quero" / "pedido" sem produto). Match exato
 * apos normalizar + stripar pontuacao.
 */
export const BARE_ORDER_PHRASES: ReadonlySet<string> = new Set([
  'quero',
  'pedido',
  'pedir',
  'comprar',
  'preciso',
  'quero pedir',
  'quero comprar',
  'vou querer',
  'me manda',
  'manda',
  'gostaria de',
  'quero fazer um pedido',
]);

export const CATALOG_REQUEST_RE = /\b(cardapio|catalogo|catalogue|menu)\b/;

export const PRICE_QUESTION_RE =
  /\b(preco|valor|quanto custa|qual o valor|quanto sai|quanto fica)\b/;

export const STOCK_QUESTION_BASE_RE = /\b(estoque|disponivel|disponibilidade)\b/;
export const STOCK_QUESTION_COMPOUND_RE =
  /\b(tem|ainda tem|restou|sobrou)\b.*\b(estoque|disponivel)\b/;

export const SCHEDULE_QUESTION_RE =
  /\b(horario|funciona|aberto|fecha|abre)\b/;

export const HELP_REQUEST_RE = /^(ajuda|help|comandos)$/;

/**
 * Padroes que indicam que a mensagem NAO eh apenas saudacao (tem
 * conteudo de comercio embutido).
 */
export const GREETING_NEGATIVE_SIGNALS_RE =
  /\b(quero|preciso|preco|valor|estoque|pedido|indica|recomenda|sugere|compar|barato|caro|produto|item)\b/;

export const GREETING_SHAPE_RE =
  /^(oi|ola|bom dia|boa tarde|boa noite)(?:\s+tudo bem)?$/;

// --- Wrappers tipados ---

export function isDirectCatalogRequest(
  message: string,
  normalizeText: TextNormalizer,
): boolean {
  return CATALOG_REQUEST_RE.test(normalizeText(message));
}

export function isDirectPriceQuestion(
  message: string,
  normalizeText: TextNormalizer,
): boolean {
  return PRICE_QUESTION_RE.test(normalizeText(message));
}

export function isDirectStockQuestion(
  message: string,
  normalizeText: TextNormalizer,
): boolean {
  const normalized = normalizeText(message);
  return (
    STOCK_QUESTION_BASE_RE.test(normalized) ||
    STOCK_QUESTION_COMPOUND_RE.test(normalized)
  );
}

export function isDirectScheduleQuestion(
  message: string,
  normalizeText: TextNormalizer,
): boolean {
  return SCHEDULE_QUESTION_RE.test(normalizeText(message));
}

export function isDirectHelpRequest(
  message: string,
  normalizeText: TextNormalizer,
): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  return HELP_REQUEST_RE.test(normalized);
}

export function isDirectGreeting(
  message: string,
  normalizeText: TextNormalizer,
): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (GREETING_NEGATIVE_SIGNALS_RE.test(normalized)) return false;
  return GREETING_SHAPE_RE.test(normalized);
}
