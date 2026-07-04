/**
 * Constantes de seguranca do modulo de auth.
 */

/**
 * Custo do bcrypt para hashes NOVOS. Hashes ja existentes seguem o custo
 * gravado no proprio hash (o bcrypt.compare le o custo do hash), entao subir
 * este valor nao invalida senhas antigas — so fortalece as novas.
 */
export const BCRYPT_COST = 12;

/**
 * Prefixo da denylist de tokens revogados (por jti) no Redis. O logout poe o
 * jti do token aqui com TTL = vida restante do token, e o validateUser rejeita
 * qualquer token cujo jti esteja na lista.
 */
export const REVOKED_TOKEN_PREFIX = 'auth:revoked:';
