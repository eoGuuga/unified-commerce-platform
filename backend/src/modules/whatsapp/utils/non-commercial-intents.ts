/**
 * Detectores e listas pra distinguir mensagens nao-comerciais:
 *  - "isLikelyNonCommercial": cliente solta exclamacao emocional ou
 *    fala que vai fazer outra coisa (cozinhar, dormir, etc).
 *  - "isOutOfFlowStop": cliente diz "para com isso" / "tira isso" /
 *    "chega" - quer abortar a interacao sem necessariamente cancelar
 *    pedido.
 *
 * Constantes puras + funcoes que recebem o normalizador.
 */

import { TextNormalizer } from './address-helpers';

export const NON_COMMERCIAL_EMOTIONAL_PHRASES: ReadonlyArray<string> = [
  'meu deus',
  'mds',
  'socorro',
  'credo',
  'aff',
  'affs',
  'oxe',
  'eita',
  'que isso',
  'para com isso',
  'tira isso',
  'pelo amor de deus',
];

/**
 * Padrao "vou fazer X / to fazer X" onde X eh atividade nao-comercial.
 */
export const NON_COMMERCIAL_ACTIVITY_RE =
  /^(vou|to|estou|fui)\s+(fazer|comer|cozinhar|dormir|sair|trabalhar|estudar)\b/;

export const OUT_OF_FLOW_STOP_PHRASES: ReadonlyArray<string> = [
  'tira isso',
  'para com isso',
  'pare com isso',
  'deixa isso',
  'deixa quieto',
  'para ai',
  'pare ai',
];

/**
 * Termos que indicam que "para/pare/chega" eh comercial (cliente quer
 * presentear/dividir/etc) e NAO deve ser tratado como stop.
 */
export const OUT_OF_FLOW_STOP_GUARD_RE =
  /\b(presente|presentear|dividir|visita|sobremesa|matar a vontade)\b/;

/**
 * Predicate: mensagem soa nao-comercial?
 */
export function isLikelyNonCommercialMessage(
  message: string,
  normalizeText: TextNormalizer,
  hasAnyPhrase: (normalized: string, phrases: string[]) => boolean,
): boolean {
  const normalized = normalizeText(message);
  if (!normalized) {
    return false;
  }

  if (hasAnyPhrase(normalized, [...NON_COMMERCIAL_EMOTIONAL_PHRASES])) {
    return true;
  }

  return NON_COMMERCIAL_ACTIVITY_RE.test(normalized);
}

/**
 * Predicate: mensagem indica "stop" fora do fluxo de coleta.
 */
export function isOutOfFlowStopIntent(
  message: string,
  normalizeText: TextNormalizer,
  hasAnyPhrase: (normalized: string, phrases: string[]) => boolean,
): boolean {
  const normalized = normalizeText(message);
  if (!normalized) {
    return false;
  }

  if (hasAnyPhrase(normalized, [...OUT_OF_FLOW_STOP_PHRASES])) {
    return true;
  }

  if (/^(para|pare|chega)\b/.test(normalized)) {
    if (OUT_OF_FLOW_STOP_GUARD_RE.test(normalized)) {
      return false;
    }

    return normalized.split(/\s+/).length <= 2;
  }

  return false;
}
