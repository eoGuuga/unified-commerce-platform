/**
 * Mascaramento de PII para LOGS (LGPD). Mostra o minimo pra identificar
 * aproximadamente ("qual cliente?") sem expor o dado completo. Uso exclusivo
 * em log/observabilidade — NUNCA para persistir ou transmitir dado mascarado
 * como se fosse o valor real.
 */

/**
 * Telefone -> dois primeiros + dois ultimos digitos, o meio mascarado.
 * Ex.: "5511998887766" -> "55****66"; "(11) 99888-7766" -> "11****66".
 * Curto demais (<6 digitos) ou vazio -> totalmente mascarado.
 */
export function maskPhone(value?: unknown): string {
  if (value == null) return '(sem telefone)';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return '(sem telefone)';
  if (digits.length < 6) return '****';
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

/**
 * Email -> primeira letra do local + dominio completo (dominio nao e PII).
 * Ex.: "joao@gmail.com" -> "j***@gmail.com"; "a@x.com" -> "a***@x.com".
 * Sem "@" valido ou vazio -> totalmente mascarado.
 */
export function maskEmail(value?: unknown): string {
  if (value == null) return '(sem email)';
  const email = String(value).trim();
  if (email === '') return '(sem email)';
  const at = email.indexOf('@');
  // Precisa de ao menos 1 char antes do @ e algo depois do @.
  if (at < 1 || at === email.length - 1) return '***';
  return `${email[0]}***@${email.slice(at + 1)}`;
}
