/**
 * Campo de moeda BR para "valor recebido" no caixa (puro, sem React).
 *
 * Comportamento de caixa-eletronico: os digitos preenchem os CENTAVOS da direita
 * para a esquerda. Digitar "123312" significa R$ 1.233,12 — NAO R$ 123.312,00.
 *
 * Sem isto, `Number("123312".replace(',', '.'))` leria os digitos como reais
 * inteiros e estouraria o troco (bug: total R$ 460,30 -> troco R$ 122.851,70).
 */

const cashFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Extrai so os digitos da string (descarta pontos, virgulas, espacos, etc.). */
function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Converte os digitos do campo em reais (centavos -> reais).
 * "123312" -> 1233.12 ; "50000" -> 500 ; "5" -> 0.05 ; "" -> 0 ; "00" -> 0.
 */
export function cashDigitsToReais(raw: string): number {
  const digits = onlyDigits(raw);
  if (digits === '') return 0;
  return parseInt(digits, 10) / 100;
}

/**
 * Formata os digitos do campo como moeda BR (sem o "R$"), para exibir no input.
 * "123312" -> "1.233,12" ; "50000" -> "500,00" ; "5" -> "0,05" ; "" -> "".
 */
export function formatCashInput(raw: string): string {
  const digits = onlyDigits(raw);
  if (digits === '') return '';
  return cashFormatter.format(parseInt(digits, 10) / 100);
}
