/**
 * Extratores de dados de cliente em mensagens do bot WhatsApp.
 * - extractCustomerNameCandidate: tira prefixos comuns ("meu nome eh",
 *   "me chamo", "eu sou") e ruidos de despedida ("ok", "obrigada").
 * - extractPhoneDigitsCandidate: sanitize + so digitos.
 * - looksLikeStandalonePhoneMessage: heuristica pra mensagens onde o
 *   cliente envia somente o telefone, sem contexto.
 */

import {
  TextNormalizer,
  hasAddressKeyword,
} from './address-helpers';
import { sanitizeInput } from './sanitize';

/**
 * Tenta extrair um candidato a nome do cliente removendo prefixos de
 * apresentacao em portugues e ruidos de despedida no final.
 */
export function extractCustomerNameCandidate(message: string): string {
  return sanitizeInput(message.trim())
    .replace(
      /^(?:meu\s+nome\s+[eé]|o\s+nome\s+[eé]|nome\s+[eé]|me\s+chamo|eu\s+sou|sou\s+(?:o|a)|pode\s+colocar\s+no\s+nome\s+de|coloca\s+no\s+nome\s+de|anota\s+no\s+nome\s+de|prazer[,:\s]*)\s+/i,
      '',
    )
    .replace(/\b(?:ta\s+bom|t[aá]|ok|beleza|blz|valeu|obrigad[oa]|por\s+favor)\b$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retorna apenas os digitos extraidos da mensagem (apos sanitize).
 * Util pra comparar contra telefones armazenados.
 */
export function extractPhoneDigitsCandidate(message: string): string {
  return sanitizeInput(message).replace(/\D/g, '');
}

/**
 * True se a mensagem provavelmente eh "so um telefone" (sem ser endereco
 * ou outra coisa). Verifica:
 *  - nao tem palavra de endereco e nao tem CEP
 *  - tem 10-11 digitos (telefone BR com DDD)
 *  - OU formato "+xx (xx) xxxxx-xxxx" (incluindo prefixo de pais)
 *  - OU comeca com "meu numero/telefone/whatsapp/zap"
 */
export function looksLikeStandalonePhoneMessage(
  message: string,
  normalizeText: TextNormalizer,
): boolean {
  const sanitized = sanitizeInput((message || '').trim());
  if (!sanitized) {
    return false;
  }

  if (hasAddressKeyword(sanitized, normalizeText) || /\b\d{5}-?\d{3}\b/.test(sanitized)) {
    return false;
  }

  const normalized = normalizeText(sanitized);
  const digitsOnly = extractPhoneDigitsCandidate(sanitized);
  if (digitsOnly.length < 10 || digitsOnly.length > 11) {
    return false;
  }

  if (/^\+?\d[\d\s().-]{8,}$/.test(sanitized)) {
    return true;
  }

  return /^(meu numero|meu telefone|telefone|numero|zap|whatsapp)\b/.test(normalized);
}
