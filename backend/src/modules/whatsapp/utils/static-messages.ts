/**
 * Mensagens "premium" estaticas do bot WhatsApp e helpers de detecao
 * pequenos relacionados. Tudo puro.
 */

import { formatCurrencyBR } from './order-formatters';
import { sanitizeInput } from './sanitize';

export const PREMIUM_SOFT_RESET_MESSAGE = [
  'Sem problema, vou parar por aqui.',
  '',
  'Quando quiser retomar, eu monto um novo pedido com voce sem perder tempo.',
  'Se preferir, envie "cardapio" para ver os itens ou "ajuda" para ver os atalhos.',
].join('\n');

export const PREMIUM_NON_COMMERCIAL_RECOVERY_MESSAGE = [
  'Calma, acho que eu puxei a conversa para o lado errado.',
  '',
  'Essa mensagem nao parece um pedido da loja, entao eu prefiro nao inventar item, preco ou quantidade.',
  'Se voce quiser comprar, me diga o produto do seu jeito ou envie "cardapio".',
  'Se era outro assunto, pode me explicar em uma frase que eu tento te entender sem forcar um pedido.',
].join('\n');

export const PREMIUM_CARD_PAYMENT_FALLBACK_MESSAGE = [
  'No WhatsApp, eu consigo fechar este pedido com seguranca por *PIX* ou *dinheiro*.',
  '',
  'Para cartao, a equipe precisa concluir manualmente para nao gerar erro no pagamento.',
  'Se quiser seguir agora por aqui, responda: "pix" ou "dinheiro".',
].join('\n');

export const PREMIUM_ADDRESS_PROMPT = [
  'ENDERECO DE ENTREGA',
  '',
  'Me envie o endereco completo para a entrega sair sem atrito.',
  'Inclua rua, numero, complemento, bairro, cidade, estado e CEP.',
  '',
  'Exemplo: "Rua das Flores, 123, Apto 45, Centro, Sao Paulo, SP, 01234-567".',
].join('\n');

/**
 * Constroi o prompt do rascunho de endereco. Recebe se o rascunho ja tem
 * referencia a estado/UF como flag, em vez de chamar diretamente
 * containsStateReference (que precisa do normalizador).
 */
export function buildPremiumAddressDraftPrompt(
  draftText: string,
  hasState: boolean,
): string {
  const hasNumber = /\d/.test(draftText);
  const hasCep = /\b\d{5}-?\d{3}\b/.test(draftText);

  const nextStep = !hasNumber
    ? 'Agora me envie o numero.'
    : !hasState
      ? 'Agora complete com bairro, cidade e estado.'
      : !hasCep
        ? 'Se puder, complete com CEP ou complemento para reduzir erro na entrega.'
        : 'Se quiser, complete com complemento para reduzir erro na entrega.';

  return [
    'Estou montando o endereco por etapas para evitar erro de entrega.',
    '',
    `Rascunho atual: ${draftText}`,
    nextStep,
    'Exemplo completo: "Rua das Flores, 123, Apto 45, Centro, Sao Paulo, SP, 01234-567".',
  ].join('\n');
}

/**
 * Mensagem de opcoes de pagamento padrao (texto, sem emojis pesados).
 * Diferente de getPremiumPaymentOptionsMessage em order-messages.ts
 * por ter formato classico com emojis numericos.
 */
export function getPaymentOptionsMessage(total: number): string {
  const totalAmount = Number(total || 0);
  const pixAmount = totalAmount > 0 ? totalAmount * 0.95 : 0;
  return (
    `💳 *ESCOLHA A FORMA DE PAGAMENTO:*\n\n` +
    `1️⃣ *PIX* - Desconto de 5% (R$ ${formatCurrencyBR(pixAmount)})\n` +
    `2️⃣ *Dinheiro*\n\n` +
    `💬 Digite o número ou o nome do método de pagamento.\n` +
    `Exemplo: "1", "pix", "dinheiro"`
  );
}

const EXPLICIT_NAME_INTRODUCTION_RE =
  /^(?:meu\s+nome\s+[eé]|o\s+nome\s+[eé]|nome\s+[eé]|me\s+chamo|eu\s+sou|sou\s+(?:o|a)|prazer\b)/i;

/**
 * True se a mensagem comeca com uma forma explicita de apresentacao
 * pessoal ("meu nome eh", "me chamo", "eu sou", "prazer", ...).
 */
export function looksLikeExplicitNameIntroduction(message: string): boolean {
  return EXPLICIT_NAME_INTRODUCTION_RE.test(
    sanitizeInput((message || '').trim()),
  );
}

/**
 * Horario padrao de funcionamento. Sera overridado pelo service se
 * tenant tiver setting proprio (proxima iteracao).
 */
export const DEFAULT_HORARIO_FUNCIONAMENTO =
  'Segunda a Sábado: 8h às 18h\nDomingo: 9h às 13h';

export const PREMIUM_PHONE_PROMPT = [
  'TELEFONE DE CONTATO',
  '',
  'Antes de fechar, preciso do melhor numero para atualizar voce sobre o pedido.',
  'Pode ser celular ou telefone fixo, desde que venha com DDD.',
  'Pode enviar no formato:',
  '- (11) 98765-4321',
  '- 11987654321',
].join('\n');

export const PREMIUM_NOTES_PROMPT = [
  'OBSERVACOES DO PEDIDO',
  '',
  'Se quiser, me diga algum detalhe importante para a equipe.',
  'Exemplo: "sem acucar", "entregar na portaria" ou "caprichar na embalagem".',
  '',
  'Se nao houver observacoes, responda: "sem".',
].join('\n');

export const PREMIUM_HELP_MESSAGE = [
  'COMO POSSO AJUDAR',
  '',
  'Voce pode falar comigo de forma natural ou usar atalhos como:',
  '- "cardapio" para ver a vitrine da loja',
  '- "preco de brigadeiro" para consultar um item',
  '- "estoque de bolo de chocolate" para ver disponibilidade',
  '- "quero 10 brigadeiros" para montar um pedido',
  '- "status do pedido" para acompanhar a compra',
  '- "reabrir pedido" para retomar um pagamento pendente',
  '',
  'Tambem posso recomendar produtos se voce disser algo como:',
  '"me indica algo para presente" ou "o que voce tem com chocolate?"',
].join('\n');

export const PREMIUM_GREETING_MESSAGE = [
  'Ola! Sou o concierge da loja no WhatsApp.',
  '',
  'Posso te ajudar a descobrir produtos, montar o pedido, acompanhar a compra e retomar pagamento sem perder contexto.',
  '',
  'Se quiser um atalho, envie "ajuda".',
].join('\n');

export const PREMIUM_FALLBACK_MESSAGE = [
  'Nao quero te deixar preso num menu engessado.',
  '',
  'Pode falar do seu jeito que eu tento puxar para o caminho certo.',
  'Se preferir um atalho, eu tambem consigo ajudar com coisas como:',
  '- "quero 10 brigadeiros"',
  '- "me indica algo para presente"',
  '- "preco de brownie"',
  '- "status do pedido"',
  '',
  'Se tiver dado algum problema, pode dizer algo como "o pix nao apareceu" ou "acho que voce nao entendeu".',
].join('\n');

/**
 * Prompt de escolha entrega vs retirada. Personaliza saudacao com nome
 * quando disponivel.
 */
export function buildPremiumDeliveryChoicePrompt(customerName?: string): string {
  return [
    customerName ? `Perfeito, ${customerName}.` : 'Perfeito.',
    '',
    'Como voce prefere receber esse pedido?',
    '1. Entrega',
    '2. Retirada',
    '',
    'Responda com "1", "2", "entrega" ou "retirada".',
  ].join('\n');
}

/**
 * Mensagem quando o usuario respondeu algo que nao eh "entrega" nem
 * "retirada" e o bot precisa re-perguntar.
 */
export function buildPremiumDeliveryChoiceValidationMessage(
  customerName?: string,
): string {
  return [
    customerName ? `Perfeito, ${customerName}.` : 'Perfeito.',
    '',
    'Antes de seguir, eu preciso alinhar se vai ser entrega ou retirada para nao montar endereco errado.',
    'Responda so com uma destas opcoes:',
    '1. Entrega',
    '2. Retirada',
  ].join('\n');
}

/**
 * Mensagem do horario. Recebe a string do horario pra permitir override
 * por tenant.
 */
export function buildPremiumScheduleMessage(
  horarioFuncionamento: string,
): string {
  return [
    'HORARIO DE ATENDIMENTO',
    '',
    horarioFuncionamento,
    '',
    'Se quiser, eu ja posso te ajudar a montar o pedido agora.',
  ].join('\n');
}
