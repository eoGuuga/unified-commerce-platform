import { describe, expect, it, vi } from 'vitest';

vi.mock('./config', () => ({
  API_BASE_URL: 'https://api.test/api/v1',
  TENANT_ID: 'tenant-default',
}));

import {
  normalizeApiError,
  API_ERROR_MESSAGES,
  API_ERROR_CODE_MESSAGES,
} from './api-client';

/** Constrói um erro no formato que o request<T>() produz (message crua + status/code). */
function apiError(
  message: string,
  extra: { status?: number; code?: string } = {},
): Error {
  return Object.assign(new Error(message), extra);
}

/** União de todas as mensagens amigáveis conhecidas (a whitelist = o contrato). */
const WHITELIST = new Set<string>([
  ...Object.values(API_ERROR_MESSAGES),
  ...Object.values(API_ERROR_CODE_MESSAGES),
]);

/** Fragmentos técnicos crus que JAMAIS podem aparecer para o usuário. */
const TECH_FRAGMENTS = [
  'JWT',
  'html',
  'ECONNREFUSED',
  'QueryFailedError',
  'undefined',
  'malformed',
  'Internal server error',
  'stack',
  'Bad Gateway',
];

function assertFriendly(result: string, rawInput: string) {
  // 1. Nunca ecoa o texto cru do backend.
  expect(result).not.toContain(rawInput);
  // 2. Nunca contém fragmento técnico conhecido.
  for (const frag of TECH_FRAGMENTS) {
    expect(result.toLowerCase()).not.toContain(frag.toLowerCase());
  }
  // 3. É uma das mensagens amigáveis da whitelist.
  expect(WHITELIST.has(result)).toBe(true);
}

describe('normalizeApiError — nunca vaza texto técnico cru', () => {
  // Erros técnicos variados que o backend/infra podem vazar, em vários status.
  const TECHNICAL_LEAKS = [
    'Invalid JWT',
    'Internal server error',
    'ECONNREFUSED 127.0.0.1:5432',
    '<html><body>502 Bad Gateway</body></html>',
    'QueryFailedError: duplicate key value violates unique constraint "produtos_pkey"',
    'Cannot read properties of undefined (reading "tenant_id")',
    'jwt malformed',
    'Request failed',
  ];
  const STATUSES = [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, undefined];

  for (const leak of TECHNICAL_LEAKS) {
    for (const status of STATUSES) {
      it(`vira mensagem amigável: "${leak.slice(0, 24)}…" (status ${status})`, () => {
        const result = normalizeApiError(apiError(leak, { status }));
        assertFriendly(result, leak);
      });
    }
  }

  it('erro sem status e sem ser rede → fallback genérico da whitelist', () => {
    const result = normalizeApiError(apiError('QueryFailedError: boom'));
    assertFriendly(result, 'QueryFailedError: boom');
    expect(result).toBe(API_ERROR_MESSAGES.generic);
  });

  it('string crua lançada (não-Error) também não vaza', () => {
    const result = normalizeApiError('Internal server error');
    expect(result).not.toContain('Internal server error');
    expect(WHITELIST.has(result)).toBe(true);
  });
});

describe('normalizeApiError — mapeia por status/código/contexto', () => {
  it('rede (TypeError do fetch) → mensagem de conexão', () => {
    const result = normalizeApiError(new TypeError('Failed to fetch'));
    expect(result).toBe(API_ERROR_MESSAGES.network);
  });

  it('401 genérico → sessão expirada', () => {
    expect(normalizeApiError(apiError('Invalid JWT', { status: 401 }))).toBe(
      API_ERROR_MESSAGES.sessionExpired,
    );
  });

  it('401 no login → credenciais incorretas (não "sessão expirada")', () => {
    expect(
      normalizeApiError(apiError('Unauthorized', { status: 401 }), {
        context: 'login',
      }),
    ).toBe(API_ERROR_MESSAGES.loginCredentials);
  });

  it('5xx no login → mensagem de servidor do login', () => {
    expect(
      normalizeApiError(apiError('Internal server error', { status: 500 }), {
        context: 'login',
      }),
    ).toBe(API_ERROR_MESSAGES.loginServer);
  });

  it('403 → sem permissão', () => {
    expect(normalizeApiError(apiError('Forbidden', { status: 403 }))).toBe(
      API_ERROR_MESSAGES.forbidden,
    );
  });

  it('422/400 → dados inválidos', () => {
    expect(normalizeApiError(apiError('validation failed', { status: 422 }))).toBe(
      API_ERROR_MESSAGES.invalid,
    );
    expect(normalizeApiError(apiError('bad request', { status: 400 }))).toBe(
      API_ERROR_MESSAGES.invalid,
    );
  });

  it('5xx genérico → mensagem de servidor', () => {
    expect(normalizeApiError(apiError('Internal server error', { status: 503 }))).toBe(
      API_ERROR_MESSAGES.server,
    );
  });

  it('429 → limite de tentativas', () => {
    expect(normalizeApiError(apiError('Too Many Requests', { status: 429 }))).toBe(
      API_ERROR_MESSAGES.rateLimit,
    );
  });

  it('código estruturado tem precedência (INSUFFICIENT_STOCK → msg específica)', () => {
    const result = normalizeApiError(
      apiError('Estoque insuficiente para produto X', {
        status: 422,
        code: 'INSUFFICIENT_STOCK',
      }),
    );
    expect(result).toBe(API_ERROR_CODE_MESSAGES.INSUFFICIENT_STOCK);
  });

  it('fallback custom é usado quando o status não é classificável', () => {
    const result = normalizeApiError(apiError('weird', { status: 418 }), {
      fallback: 'Falha ao criar produto.',
    });
    expect(result).toBe('Falha ao criar produto.');
  });

  it('404 usa o fallback custom quando dado', () => {
    expect(
      normalizeApiError(apiError('not found', { status: 404 }), {
        fallback: 'Pedido não encontrado.',
      }),
    ).toBe('Pedido não encontrado.');
  });
});
