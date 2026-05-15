/**
 * Parsers de endereco do bot WhatsApp.
 *  - parseAddress: para entrada estruturada com virgulas
 *    (ex: "Rua A, 123, Centro, Sao Paulo, SP, 01000-000").
 *  - parseLooseAddress: fallback para entrada sem virgulas,
 *    onde o texto vem todo numa linha unica.
 *  - parseAddressCandidate: tenta ambos.
 *
 * Funcoes puras. Recebem `normalizeText` (= messageIntelligenceService
 * .normalizeText) como parametro pra evitar acoplamento com o servico.
 */

import {
  BRAZIL_STATE_NAME_TO_CODE,
} from './brazil-states';
import {
  TextNormalizer,
  extractStateCodeFromText,
  normalizeAddressCandidate,
} from './address-helpers';

export interface ParsedAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

/**
 * Palavras-chave que indicam complemento (apto, bloco, sala, etc).
 * Usadas para nao confundir complemento com bairro/cidade.
 */
export const ADDRESS_COMPLEMENT_KEYWORDS: ReadonlySet<string> = new Set([
  'apto',
  'apartamento',
  'bloco',
  'bl',
  'casa',
  'fundos',
  'sala',
  'sl',
  'cj',
  'conjunto',
  'loja',
  'andar',
  'cobertura',
  'cob',
  'quadra',
  'qd',
  'lote',
  'lt',
]);

/**
 * Parser estruturado: espera entrada separada por virgulas no formato
 * "Rua, numero, complemento, bairro, cidade, estado, CEP" (alguns campos
 * podem estar fundidos no primeiro segmento).
 *
 * Retorna null se nao houver pelo menos 3 partes apos split por virgula.
 */
export function parseAddress(
  addressText: string,
  normalizeText: TextNormalizer,
): ParsedAddress | null {
  const parts = addressText
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  // CEP a partir do final
  let zipCode = '';
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const match = parts[i].match(/(\d{5}-?\d{3})/);
    if (match) {
      zipCode = match[1].replace('-', '');
      parts.splice(i, 1);
      break;
    }
  }

  // Estado (UF) - ultimo item, pode vir junto com cidade ("Sao Paulo SP")
  let state = '';
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    const detectedState = extractStateCodeFromText(last, normalizeText);
    if (detectedState) {
      state = detectedState;
      const normalizedLast = normalizeText(last);
      const stateName = Object.entries(BRAZIL_STATE_NAME_TO_CODE).find(
        ([name, code]) => code === detectedState && normalizedLast.includes(name),
      )?.[0];
      const strippedLast = last
        .replace(new RegExp(`\\b${detectedState}\\b`, 'i'), ' ')
        .replace(/[.,-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (
        !strippedLast ||
        strippedLast === last ||
        (stateName && normalizeText(strippedLast) === stateName)
      ) {
        parts.pop();
      } else {
        parts[parts.length - 1] = strippedLast;
      }
    }
  }

  if (
    parts.length === 4 &&
    ADDRESS_COMPLEMENT_KEYWORDS.has(normalizeText(parts[2]))
  ) {
    return null;
  }

  // Cidade e bairro a partir do final
  const city = parts.length > 0 ? parts.pop() || '' : '';
  const neighborhood = parts.length > 0 ? parts.pop() || '' : '';

  // Rua e numero (do inicio)
  let street = parts.length > 0 ? parts.shift() || '' : '';
  let number = '';
  let complement: string | undefined;

  if (street) {
    const numberMatch = street.match(/(\d+)/);
    if (numberMatch) {
      number = numberMatch[1];
      street = street.replace(/\d+.*$/, '').trim();
    }
  }

  if (!number && parts.length > 0 && /^\d+[A-Za-z]?$/.test(parts[0])) {
    number = parts.shift() || '';
  }

  if (parts.length > 0) {
    complement = parts.join(', ').trim();
  }

  return {
    street: street || addressText,
    number: number || '',
    complement,
    neighborhood: neighborhood || '',
    city: city || '',
    state: state || '',
    zipCode: zipCode || '',
  };
}

/**
 * Parser para enderecos "soltos" - sem virgulas. Tipico de mensagens
 * que vem numa linha unica tipo "Rua das Flores 123 Centro Sao Paulo SP
 * 01000-000".
 *
 * Heuristicas:
 *  - Extrai CEP por regex.
 *  - Ultima palavra com UF eh estado (sai do array).
 *  - Numero eh a primeira palavra que matcha /^\d+[A-Za-z]?$/. Tudo
 *    antes vira street.
 *  - Aceita 1 ou 2 tokens de cidade depois do bairro.
 *  - Aceita complemento opcional (apto N, bloco X, ...).
 */
export function parseLooseAddress(
  addressText: string,
  normalizeText: TextNormalizer,
): ParsedAddress | null {
  const sanitized = normalizeAddressCandidate(addressText);
  if (!sanitized || sanitized.includes(',')) {
    return null;
  }

  let working = sanitized.replace(/\bcep\b/gi, ' ').replace(/\s+/g, ' ').trim();
  let zipCode = '';
  const zipMatch = working.match(/\b(\d{5}-?\d{3})\b/);
  if (zipMatch) {
    zipCode = zipMatch[1].replace('-', '');
    working = working.replace(zipMatch[0], ' ').replace(/\s+/g, ' ').trim();
  }

  const tokens = working.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) {
    return null;
  }

  let state = '';
  const lastToken = tokens[tokens.length - 1];
  const detectedState = extractStateCodeFromText(lastToken, normalizeText);
  if (detectedState) {
    state = detectedState;
    tokens.pop();
  }

  const numberIndex = tokens.findIndex((token) => /^\d+[A-Za-z]?$/.test(token));
  if (numberIndex <= 0) {
    return null;
  }

  const street = tokens.slice(0, numberIndex).join(' ').trim();
  const number = tokens[numberIndex];
  const remainder = tokens.slice(numberIndex + 1);
  if (!street || remainder.length === 0) {
    return null;
  }

  const complementParts: string[] = [];
  while (
    remainder.length > 2 &&
    ADDRESS_COMPLEMENT_KEYWORDS.has(remainder[0].toLowerCase())
  ) {
    complementParts.push(remainder.shift() as string);
    if (remainder.length > 2) {
      complementParts.push(remainder.shift() as string);
    }
  }

  if (remainder.length < 2) {
    return null;
  }

  let cityTokenCount = 1;
  if (state && remainder.length >= 3) {
    cityTokenCount = Math.min(2, remainder.length - 1);
  }

  const city = remainder.slice(-cityTokenCount).join(' ').trim();
  const neighborhood = remainder.slice(0, -cityTokenCount).join(' ').trim();
  if (!city || !neighborhood) {
    return null;
  }

  return {
    street,
    number,
    complement: complementParts.length > 0 ? complementParts.join(' ') : undefined,
    neighborhood,
    city,
    state,
    zipCode,
  };
}

/**
 * Tenta parseAddress primeiro; se falhar, tenta parseLooseAddress.
 * Aplica normalizeAddressCandidate na entrada antes.
 */
export function parseAddressCandidate(
  addressText: string,
  normalizeText: TextNormalizer,
): ParsedAddress | null {
  const normalizedCandidate = normalizeAddressCandidate(addressText);
  return (
    parseAddress(normalizedCandidate, normalizeText) ||
    parseLooseAddress(normalizedCandidate, normalizeText)
  );
}
