/**
 * Templates de mensagens compostas usadas pelo bot:
 * - handoff (preparando contexto para humano)
 * - recap (resumo do que ja foi entendido)
 * - deteccao de feedback de "nao ajudou"
 *
 * Funcoes puras - sem this, sem servicos.
 */

/**
 * Mensagem preparando handoff para atendimento humano, com resumo
 * "mastigado" para o agente.
 */
export function buildMemoryAwareHandoffMessage(
  lead: string,
  summaryLines: string[],
  guidance: string,
): string {
  return [
    lead,
    '',
    'Posso deixar esse contexto mastigado para atendimento humano, sem te fazer repetir tudo.',
    '',
    'RESUMO PRONTO PARA ATENDIMENTO',
    ...summaryLines,
    '',
    guidance,
  ].join('\n');
}

/**
 * Recap do contexto conhecido. Se nao houver linhas, exibe placeholder.
 */
export function buildContextRecapMessage(
  lead: string,
  summaryLines: string[],
  guidance: string,
): string {
  return [
    lead,
    '',
    'RESUMO DO QUE JA ENTENDI',
    ...(summaryLines.length
      ? summaryLines
      : ['- Ainda nao tenho contexto suficiente travado aqui.']),
    '',
    guidance,
  ].join('\n');
}

const UNRESOLVED_FEEDBACK_SIGNALS = [
  'nao ajudou',
  'isso nao ajudou',
  'nao resolveu',
  'isso nao resolveu',
  'continua sem resolver',
  'nao era bem isso',
  'ainda nao resolveu',
];

/**
 * True se a mensagem normalizada do cliente indica frustracao com a
 * resposta anterior do bot ("nao ajudou", "nao resolveu", etc).
 */
export function isConversationalUnresolvedFeedback(
  normalizedMessage: string,
): boolean {
  if (!normalizedMessage) {
    return false;
  }

  return UNRESOLVED_FEEDBACK_SIGNALS.some((signal) =>
    normalizedMessage.includes(signal),
  );
}
