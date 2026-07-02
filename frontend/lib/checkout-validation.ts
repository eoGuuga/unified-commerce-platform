/**
 * Validação de formato dos dados do checkout (puro, sem React).
 *
 * O checkout emite nota fiscal e cria a conta — dados inválidos (e-mail sem @,
 * CPF/CNPJ com letras ou dígito verificador errado, telefone incompleto) travam
 * a operação lá na frente. Validamos ANTES de avançar do passo "dados".
 */

/** Extrai só os dígitos (descarta pontos, traços, espaços, parênteses). */
function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** E-mail com formato básico válido (usuario@dominio.tld). */
export function isValidEmail(email: string): boolean {
  const value = email.trim();
  // Um @, texto antes e depois, e um ponto no domínio com TLD de 2+ letras.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** CPF válido (11 dígitos + dígitos verificadores corretos). */
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (000..., 111...), que passam no cálculo mas são inválidas.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (slice: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < slice.length; i++) {
      soma += parseInt(slice[i], 10) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}

/** CNPJ válido (14 dígitos + dígitos verificadores corretos). */
export function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (slice: string, pesos: number[]): number => {
    let soma = 0;
    for (let i = 0; i < slice.length; i++) {
      soma += parseInt(slice[i], 10) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcDigit(cnpj.slice(0, 12), pesos1);
  const d2 = calcDigit(cnpj.slice(0, 13), pesos2);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
}

/** Aceita CPF (11) OU CNPJ (14) — o campo do checkout é "CPF ou CNPJ". */
export function isValidCpfCnpj(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

/** Telefone BR: 10 (fixo) ou 11 (celular) dígitos, com DDD válido (11–99). */
export function isValidBrPhone(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11) return false;
  // Celular (11 dígitos) começa com 9 após o DDD.
  if (digits.length === 11 && digits[2] !== '9') return false;
  return true;
}

export interface CheckoutContact {
  nome: string;
  email: string;
  cpfCnpj: string;
  telefone: string;
}

export type CheckoutContactErrors = Partial<Record<keyof CheckoutContact, string>>;

/**
 * Valida os campos obrigatórios do passo "dados". Retorna um mapa de erros
 * (vazio = tudo válido). Mensagens claras, prontas para exibir sob cada campo.
 */
export function validateCheckoutContact(
  form: CheckoutContact,
): CheckoutContactErrors {
  const errors: CheckoutContactErrors = {};

  if (!form.nome.trim()) {
    errors.nome = 'Informe seu nome completo.';
  }
  if (!form.email.trim()) {
    errors.email = 'Informe seu e-mail.';
  } else if (!isValidEmail(form.email)) {
    errors.email = 'E-mail inválido. Confira o formato (voce@empresa.com).';
  }
  if (!form.cpfCnpj.trim()) {
    errors.cpfCnpj = 'Informe seu CPF ou CNPJ.';
  } else if (!isValidCpfCnpj(form.cpfCnpj)) {
    errors.cpfCnpj = 'CPF ou CNPJ inválido. Confira os números.';
  }
  if (!form.telefone.trim()) {
    errors.telefone = 'Informe seu WhatsApp.';
  } else if (!isValidBrPhone(form.telefone)) {
    errors.telefone = 'Telefone inválido. Use DDD + número, ex.: (11) 99999-9999.';
  }

  return errors;
}
