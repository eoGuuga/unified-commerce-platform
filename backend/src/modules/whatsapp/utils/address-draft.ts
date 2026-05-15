/**
 * Manipulacao do "rascunho de endereco" - lista de fragmentos que o cliente
 * envia aos poucos ate completar o endereco (ex: "Rua A", depois "123",
 * depois "Centro, SP, 01000-000").
 *
 * Funcoes puras. As que precisam de `normalizeText` recebem o normalizador
 * como parametro (assim como em address-helpers).
 */

import {
  TextNormalizer,
  hasAddressKeyword,
  normalizeAddressCandidate,
} from './address-helpers';

/**
 * Extrai e sanitiza o draft armazenado em conversation.context.address_draft_parts.
 * Aceita o array bruto direto - o caller faz `conversation?.context?.address_draft_parts`.
 */
export function getAddressDraftParts(rawDraft: unknown): string[] {
  if (!Array.isArray(rawDraft)) {
    return [];
  }

  return rawDraft
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Junta as partes do draft em uma unica string, separadas por virgula,
 * normalizando whitespace e virgulas duplicadas.
 */
export function buildAddressDraftText(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s+,/g, ',')
    .trim();
}

/**
 * Mescla `nextPart` no draft existente:
 *  - se `nextPart` parece um endereco completo novo (rua + numero + len>=12),
 *    e o draft existente nao tem rua ainda OU so tem fragmentos soltos,
 *    substitui o draft por [nextPart].
 *  - se ja existe parte similar (containment normalizado), preserva a mais
 *    longa.
 *  - caso contrario, append (limitando a 5 partes - mantemos as 4 ultimas
 *    + a nova).
 */
export function mergeAddressDraftParts(
  parts: string[],
  nextPart: string,
  normalizeText: TextNormalizer,
): string[] {
  const sanitizedPart = normalizeAddressCandidate(nextPart);
  if (!sanitizedPart) {
    return parts;
  }

  const normalizedPart = normalizeText(sanitizedPart);
  if (!normalizedPart) {
    return parts;
  }

  const looksLikeFreshAddress =
    hasAddressKeyword(sanitizedPart, normalizeText) &&
    /\d/.test(sanitizedPart) &&
    sanitizedPart.length >= 12;

  if (looksLikeFreshAddress) {
    const existingHasStreetLike = parts.some((part) =>
      hasAddressKeyword(part, normalizeText),
    );
    const existingOnlyLooseFragments = parts.every((part) => {
      const normalizedExisting = normalizeAddressCandidate(part);
      return (
        /^\d{1,8}[A-Za-z]?$/.test(normalizedExisting) ||
        /\b\d{5}-?\d{3}\b/.test(normalizedExisting) ||
        !hasAddressKeyword(normalizedExisting, normalizeText)
      );
    });

    if (existingHasStreetLike || existingOnlyLooseFragments) {
      return [sanitizedPart];
    }
  }

  const merged = [...parts];
  const existingIndex = merged.findIndex((part) => {
    const existing = normalizeText(part);
    return (
      existing === normalizedPart ||
      existing.includes(normalizedPart) ||
      normalizedPart.includes(existing)
    );
  });

  if (existingIndex >= 0) {
    const existing = merged[existingIndex];
    merged[existingIndex] =
      normalizeText(existing).length >= normalizedPart.length
        ? existing
        : sanitizedPart;
    return merged;
  }

  return [...merged.slice(-4), sanitizedPart];
}

/**
 * True se o texto vale a pena ser tratado como fragmento de endereco para
 * fins de merge no draft (palavra-chave de endereco, OU numero solto curto,
 * OU CEP).
 */
export function isAddressDraftWorthy(
  text: string,
  normalizeText: TextNormalizer,
): boolean {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }

  const trimmed = text.trim();
  if (trimmed === '0') {
    return false;
  }

  return (
    hasAddressKeyword(normalized, normalizeText) ||
    /^(?:[1-9]\d{0,5}[A-Za-z]?)$/.test(trimmed) ||
    /\b\d{5}-?\d{3}\b/.test(text)
  );
}

/**
 * True se o fragmento eh "somente numero" (ex: "123") - relevante para
 * casos onde o cliente envia o numero do endereco isoladamente em uma
 * mensagem separada.
 */
export function isNumericOnlyAddressFragment(
  text: string,
  normalizeText: TextNormalizer,
): boolean {
  const candidate = normalizeAddressCandidate(text);
  return (
    /^\d{1,8}[A-Za-z]?$/.test(candidate) &&
    !hasAddressKeyword(candidate, normalizeText)
  );
}
