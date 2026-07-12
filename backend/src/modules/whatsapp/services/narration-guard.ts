/**
 * CINTURÃO do §5 sob narração (Fatia 1 do tool-calling pleno).
 *
 * Princípio: **o código é dono de TODO número; a IA só narra.** Depois que a IA
 * produz o texto ao cliente, o código verifica que ela não inventou/extrapolou
 * nenhum número. FAIL-CLOSED: se qualquer número da narração não estiver
 * autorizado (ou houver contexto de preço sem número verificável), a narração é
 * REJEITADA — o chamador cai no determinístico (o texto code-formatado com o
 * fato real). A narração da IA só é usada quando TUDO confere.
 *
 * Puro (sem I/O, sem dep) → 100% testável sem LLM vivo.
 */

export interface NarrationCheck {
  safe: boolean;
  reason: string;
}

// Sinais de que a frase FALA de preço (mesmo que o número esteja por extenso).
const PRICE_CONTEXT =
  /(r\$|reais?|custa|pre[çc]o|sai por|por apenas|fica em|vale|paga|desconto)/i;

/**
 * Extrai números "de dinheiro" da narração: `R$ X`, `X reais`, ou um decimal de
 * 2 casas (formato de preço). Normaliza vírgula/ponto → número. Dedup.
 */
function extractMoneyNumbers(text: string): number[] {
  const nums = new Set<number>();
  const push = (raw: string | undefined) => {
    if (!raw) return;
    const n = parseFloat(raw.replace(',', '.'));
    if (Number.isFinite(n)) nums.add(n);
  };
  const patterns = [
    /r\$\s*(\d{1,5}(?:[.,]\d{1,2})?)/gi, // R$ 8,00 / R$5.00
    /(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:reais|real)\b/gi, // 5 reais
    /(?<![\d.,])(\d{1,5}[.,]\d{2})(?![\d.,])/g, // 8,00 avulso (2 casas)
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      push(m[1]);
    }
  }
  return [...nums];
}

/**
 * Extrai INTEIROS PELADOS (sem R$/reais/decimal) — usado só no modo
 * `forbidBareNumbers` (check_stock B1: a tool não devolve quantidade, então
 * QUALQUER número na narração é invenção). Ignora `%` (tom: "100% disponível")
 * e partes de decimal/preço (que o extrator de dinheiro já cobre).
 */
function extractBareIntegers(text: string): number[] {
  const nums = new Set<number>();
  const re = /(?<![\d.,%R$])\b(\d{1,4})\b(?![\d.,%])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) nums.add(n);
  }
  return [...nums];
}

/**
 * Verifica a narração da IA contra os números AUTORIZADOS (os que a tool
 * devolveu + derivações que o CÓDIGO pré-computou). Tolerância de 1 centavo.
 *
 * `options.forbidBareNumbers` (opt-in, ex. check_stock B1): além do dinheiro,
 * também trata INTEIRO PELADO como fato a verificar — assim "temos uns 20"
 * (quantidade que a tool nunca devolveu) é barrado. Fica opt-in pra não fazer o
 * cinturão de-dinheiro dos outros (check_price/show_catalog) superbloquear
 * inteiro benigno.
 */
export function checkNarrationFacts(
  narration: string,
  authorized: number[],
  options: { forbidBareNumbers?: boolean } = {},
): NarrationCheck {
  const text = String(narration || '');
  const money = extractMoneyNumbers(text);
  const bare = options.forbidBareNumbers ? extractBareIntegers(text) : [];
  const found = [...new Set([...money, ...bare])];
  const hasPriceContext = PRICE_CONTEXT.test(text);

  // Nada de dinheiro e nenhum contexto de preço → nada a verificar (só tom).
  if (found.length === 0 && !hasPriceContext) {
    return { safe: true, reason: 'sem fato numérico a verificar' };
  }

  // Contexto de preço mas nenhum número extraível (ex.: "cinco reais", por
  // extenso) → FAIL-CLOSED: não dá pra verificar, então não confia.
  if (found.length === 0 && hasPriceContext) {
    return {
      safe: false,
      reason: 'contexto de preço sem número verificável (fail-closed)',
    };
  }

  const isAuthorized = (n: number) =>
    authorized.some((a) => Math.abs(a - n) < 0.01);
  const invented = found.filter((n) => !isAuthorized(n));
  if (invented.length > 0) {
    return {
      safe: false,
      reason: `número não autorizado na narração: ${invented.join(', ')}`,
    };
  }

  return { safe: true, reason: 'todos os números conferem' };
}
