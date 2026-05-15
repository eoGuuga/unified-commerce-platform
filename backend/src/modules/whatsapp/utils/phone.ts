/**
 * Helpers de normalizacao e comparacao de numeros de telefone para o bot
 * WhatsApp. Operam sobre o formato cru recebido do provider (Twilio/Evolution)
 * e tambem sobre numeros configurados em settings de tenant ou variaveis de
 * ambiente.
 */

/**
 * Remove tudo que nao for digito.
 * Aceita null/undefined - retorna string vazia.
 */
export function normalizePhoneForControl(phoneNumber?: string | null): string {
  return String(phoneNumber || '').replace(/\D/g, '');
}

/**
 * Recebe um valor solto (string, array de strings, ou undefined) vindo de env
 * var ou settings de tenant e devolve a lista normalizada e deduplicada de
 * telefones somente-digitos. Aceita separadores `,`, `;` e espaco.
 */
export function parsePhoneList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => normalizePhoneForControl(item as string | null | undefined))
          .filter(Boolean),
      ),
    );
  }

  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return [];
  }

  return Array.from(
    new Set(
      rawValue
        .split(/[\s,;]+/)
        .map((item) => normalizePhoneForControl(item))
        .filter(Boolean),
    ),
  );
}

/**
 * True se dois telefones representam o mesmo numero, comparando:
 *  - normalizacao para somente digitos
 *  - igualdade exata, OU
 *  - igualdade dos ultimos 11 digitos (cobre formatos com/sem codigo do
 *    pais "55" no caso BR).
 */
export function matchesConfiguredPhoneNumber(
  phoneNumber: string,
  configuredPhone: string,
): boolean {
  const normalizedPhone = normalizePhoneForControl(phoneNumber);
  const normalizedConfigured = normalizePhoneForControl(configuredPhone);

  if (!normalizedPhone || !normalizedConfigured) {
    return false;
  }

  if (normalizedPhone === normalizedConfigured) {
    return true;
  }

  const last11Phone = normalizedPhone.slice(-11);
  const last11Configured = normalizedConfigured.slice(-11);

  return (
    last11Phone.length === 11 &&
    last11Configured.length === 11 &&
    last11Phone === last11Configured
  );
}
