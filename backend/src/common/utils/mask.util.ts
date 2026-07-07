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

/**
 * IP -> mantem os dois primeiros octetos (rede), mascara host+sub-rede. LGPD:
 * IP e dado pessoal e o guia (CLAUDE.md) proibe logar IP cru.
 * Ex.: "203.0.113.42" -> "203.0.*.*". IPv6/desconhecido -> mascarado.
 */
export function maskIp(value?: unknown): string {
  if (value == null) return '(sem ip)';
  const ip = String(value).trim();
  if (ip === '') return '(sem ip)';
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.*.*`;
  if (ip.includes(':')) return `${ip.split(':').slice(0, 2).join(':')}:***`;
  return '***';
}

/** Mascaradores por nome de campo (case-insensitive) para details de auditoria. */
const AUDIT_FIELD_MASKERS: Record<string, (v: unknown) => string> = {
  ip: maskIp,
  clientip: maskIp,
  ipaddress: maskIp,
  phone: maskPhone,
  telefone: maskPhone,
  customer_phone: maskPhone,
  customerphone: maskPhone,
  email: maskEmail,
};

/**
 * Sanitiza um objeto de "details" de auditoria antes de logar: mascara os campos
 * cujo NOME indica PII (ip / phone / email). Chaves nao-sensiveis passam intactas.
 */
export function sanitizeAuditDetails(
  details?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (details == null || typeof details !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(details)) {
    const masker = AUDIT_FIELD_MASKERS[key.toLowerCase()];
    out[key] = masker ? masker(val) : val;
  }
  return out;
}
