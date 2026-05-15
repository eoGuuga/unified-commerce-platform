/**
 * Validadores de campos coletados via WhatsApp.
 * Retornam { valid, error? } - sem throw, sem mutacao.
 *
 * Funcoes puras (a unica dependencia externa eh sanitizeInput, ja
 * extraido em utils/sanitize.ts).
 */

import {
  MAX_ADDRESS_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PRICE,
  MIN_ADDRESS_LENGTH,
  MIN_NAME_LENGTH,
} from './limits';
import { sanitizeInput } from './sanitize';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const RESERVED_NAME_WORDS = new Set<string>([
  'sim',
  'ok',
  'pix',
  'credito',
  'debito',
  'dinheiro',
  'entrega',
  'retirada',
  'cancelar',
  'ajuda',
  'cardapio',
  'menu',
  'status',
  'pedido',
  'quero',
  'comprar',
  'pedir',
  'preco',
  'valor',
  'estoque',
  'sem',
  'nao',
]);

const ORDER_KEYWORDS_RE =
  /\b(pix|credito|debito|dinheiro|entrega|retirada|pedido|cardapio|menu|status|preco|valor|estoque|telefone|numero|celular|whatsapp|rua|avenida|bairro|cep|endereco)\b/;

const PRODUCT_KEYWORDS_RE =
  /\b(brigadeiro|beijinho|bala|bombom|banoffe|brownie|bolo|pudim|torta|pao de mel|acai|kit|caixa presenteavel)\b/;

const NAME_ALLOWED_CHARS_RE = /^[a-zA-ZÀ-ÿ\s\-']+$/;

/**
 * Valida nome completo do cliente.
 * - Tamanho entre MIN_NAME_LENGTH e MAX_NAME_LENGTH (apos sanitize).
 * - Apenas letras, espacos, acentos, hifen e apostrofo.
 * - Rejeita palavras reservadas (comandos do bot) e palavras-chave
 *   de produto/pedido que indicam que o usuario nao mandou o nome.
 */
export function validateName(name: string): ValidationResult {
  const sanitized = sanitizeInput(name);

  if (sanitized.length < MIN_NAME_LENGTH) {
    return {
      valid: false,
      error: `Nome deve ter no minimo ${MIN_NAME_LENGTH} caracteres`,
    };
  }

  if (sanitized.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Nome deve ter no maximo ${MAX_NAME_LENGTH} caracteres`,
    };
  }

  if (!NAME_ALLOWED_CHARS_RE.test(sanitized)) {
    return { valid: false, error: 'Nome contem caracteres invalidos' };
  }

  const normalized = sanitized
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  if (RESERVED_NAME_WORDS.has(normalized)) {
    return {
      valid: false,
      error: 'Preciso do nome da pessoa, nao de um comando',
    };
  }

  if (ORDER_KEYWORDS_RE.test(normalized)) {
    return {
      valid: false,
      error: 'Preciso do nome da pessoa, nao de um dado de pedido',
    };
  }

  if (PRODUCT_KEYWORDS_RE.test(normalized)) {
    return {
      valid: false,
      error: 'Isso parece nome de produto, nao nome da pessoa',
    };
  }

  return { valid: true };
}

/**
 * Valida telefone brasileiro:
 *  - apenas digitos, 10 ou 11 caracteres
 *  - DDD valido (1-9 no primeiro digito)
 *  - celular com 11 digitos comeca com 9 apos DDD
 */
export function validatePhone(phone: string): ValidationResult {
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length < 10 || digitsOnly.length > 11) {
    return {
      valid: false,
      error: 'Telefone deve ter 10 ou 11 digitos (com DDD)',
    };
  }

  if (!/^[1-9]\d/.test(digitsOnly)) {
    return {
      valid: false,
      error: 'Telefone precisa comecar com um DDD valido',
    };
  }

  const subscriber = digitsOnly.slice(2);
  if (digitsOnly.length === 11 && subscriber[0] !== '9') {
    return {
      valid: false,
      error: 'Celular com 11 digitos precisa ter o 9 apos o DDD',
    };
  }

  return { valid: true };
}

/**
 * Valida valor monetario.
 */
export function validatePrice(price: number): ValidationResult {
  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, error: 'Preco deve ser um numero valido' };
  }

  if (price <= 0) {
    return { valid: false, error: 'Preco deve ser maior que zero' };
  }

  if (price > MAX_PRICE) {
    return {
      valid: false,
      error: `Preco maximo e R$ ${MAX_PRICE.toLocaleString('pt-BR')}`,
    };
  }

  return { valid: true };
}

/**
 * Validacao basica de tamanho/sanitizacao de endereco. A validacao
 * completa (score por evidencia, keywords) ainda mora no servico
 * (depende de helpers de address que serao extraidos em iteracao futura).
 *
 * Esta funcao retorna apenas as falhas obvias de tamanho/sanitizacao.
 */
export function validateAddressBasic(address: string): ValidationResult {
  const sanitized = sanitizeInput(address);

  if (sanitized.length < MIN_ADDRESS_LENGTH) {
    return {
      valid: false,
      error: `Endereco deve ter no minimo ${MIN_ADDRESS_LENGTH} caracteres`,
    };
  }

  if (sanitized.length > MAX_ADDRESS_LENGTH) {
    return {
      valid: false,
      error: `Endereco deve ter no maximo ${MAX_ADDRESS_LENGTH} caracteres`,
    };
  }

  return { valid: true };
}
