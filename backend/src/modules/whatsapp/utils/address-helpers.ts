/**
 * Helpers de endereco do bot WhatsApp.
 *
 * `normalizeAddressCandidate` eh puro (so depende de sanitizeInput).
 *
 * As outras funcoes recebem o normalizador (`normalizeText`) como parametro
 * em vez de chamar diretamente `this.messageIntelligenceService.normalizeText`.
 * Isso permite testar sem instanciar o servico de IA - o caller injeta o
 * normalizer apropriado.
 */

import { BRAZIL_STATE_CODES, BRAZIL_STATE_NAME_TO_CODE } from './brazil-states';
import { sanitizeInput } from './sanitize';

export type TextNormalizer = (value: string) => string;

/**
 * Limpa um candidato a endereco removendo prefixos comuns ("meu endereco e",
 * "entrega na", etc), abreviacoes ("n 123" -> "123") e ruidos de despedida.
 */
export function normalizeAddressCandidate(message: string): string {
  return sanitizeInput((message || '').trim())
    .replace(
      /^(?:meu\s+endere[cç]o\s+[eé]|o\s+endere[cç]o\s+[eé]|endere[cç]o\s+[eé]|entrega\s+[eé]\s+(?:na|no)|pode\s+entregar\s+(?:na|no)|entrega\s+(?:na|no)|manda\s+(?:na|no)|fica\s+(?:na|no)|anota\s+a[ií]|segue\s+o\s+endere[cç]o|[eé]\s+na)\s+/i,
      '',
    )
    .replace(/\b(?:n[ºo]?|numero)\s*(\d+[A-Za-z]?)\b/gi, '$1')
    .replace(/\b(?:cep)\s+(\d{5}-?\d{3})\b/gi, '$1')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\b(?:ta\s+bom|ok|beleza|blz|valeu|obrigad[oa]|por\s+favor)\b$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ADDRESS_KEYWORDS_RE =
  /\b(rua|avenida|av|travessa|alameda|estrada|rodovia|bairro|cep|apto|apartamento|bloco|sala|quadra|lote|condominio|condomínio|casa)\b/i;

/**
 * True se o texto contem alguma palavra-chave de endereco (apos normalizado).
 */
export function hasAddressKeyword(
  text: string,
  normalizeText: TextNormalizer,
): boolean {
  return ADDRESS_KEYWORDS_RE.test(normalizeText(text));
}

/**
 * Extrai o codigo de UF brasileira presente no texto. Aceita tanto o
 * codigo (ex: "SP") quanto o nome do estado ("São Paulo"). Retorna ''
 * quando nao encontra.
 */
export function extractStateCodeFromText(
  value: string,
  normalizeText: TextNormalizer,
): string {
  const sanitized = sanitizeInput(value || '');
  if (!sanitized) {
    return '';
  }

  const directCodeMatch = sanitized
    .toUpperCase()
    .match(new RegExp(`\\b(?:${Array.from(BRAZIL_STATE_CODES).join('|')})\\b`));
  if (directCodeMatch) {
    return directCodeMatch[0];
  }

  const normalized = normalizeText(sanitized)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return '';
  }

  return BRAZIL_STATE_NAME_TO_CODE[normalized] || '';
}

/**
 * True se o texto referencia uma UF brasileira (codigo ou nome).
 */
export function containsStateReference(
  value: string,
  normalizeText: TextNormalizer,
): boolean {
  return Boolean(extractStateCodeFromText(value, normalizeText));
}

export interface AddressEvidence {
  score: number;
  hasStreetLike: boolean;
  hasNumber: boolean;
  hasZip: boolean;
  hasState: boolean;
  segmentCount: number;
}

/**
 * Soma evidencias de um endereco real (rua, numero, CEP, UF, virgulas).
 * Usado por `validateAddress` para decidir se o texto eh um endereco
 * plausivel ou apenas uma frase de conversa.
 *
 * Score:
 *  - +2 se tem rua/bairro/etc
 *  - +2 se tem CEP no formato 00000-000
 *  - +1 se referencia UF
 *  - +1 se tem numero
 *  - +1 se tem 3+ segmentos separados por virgula
 */
export function getAddressEvidence(
  address: string,
  normalizeText: TextNormalizer,
): AddressEvidence {
  const candidate = normalizeAddressCandidate(address);
  const segments = candidate
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const hasStreetLike = hasAddressKeyword(candidate, normalizeText);
  const hasZip = /\b\d{5}-?\d{3}\b/.test(candidate);
  const hasState = containsStateReference(candidate, normalizeText);
  const hasNumber = /\b\d{1,6}[A-Za-z]?\b/.test(candidate);

  let score = 0;
  if (hasStreetLike) score += 2;
  if (hasZip) score += 2;
  if (hasState) score += 1;
  if (hasNumber) score += 1;
  if (segments.length >= 3) score += 1;

  return {
    score,
    hasStreetLike,
    hasNumber,
    hasZip,
    hasState,
    segmentCount: segments.length,
  };
}
