/**
 * Builders de URL de acompanhamento publico de pedido.
 *
 * Funcao pura - recebe o FRONTEND_URL (ou null) como parametro explicito
 * em vez de tocar config global. O servico chamador resolve a config e
 * passa o valor pra ca.
 */

/**
 * Monta URL absoluta de acompanhamento publico do pedido.
 * Fallback: gtsofthub.com.br em prod, localhost:3000 em dev.
 */
export function buildTrackingUrl(
  orderNo: string,
  frontendUrl?: string | null,
  nodeEnv: string = process.env.NODE_ENV || '',
): string {
  const trimmedFrontend = (frontendUrl || '').trim();
  const baseUrl =
    trimmedFrontend ||
    (nodeEnv === 'production'
      ? 'https://gtsofthub.com.br'
      : 'http://localhost:3000');

  return `${baseUrl.replace(/\/+$/, '')}/pedido?order=${encodeURIComponent(orderNo)}`;
}

/**
 * URL base do portal de pedidos (sem query string).
 * Construida a partir de buildTrackingUrl e removendo `?order=...`.
 */
export function getOrdersPortalUrl(
  frontendUrl?: string | null,
  nodeEnv?: string,
): string {
  return buildTrackingUrl('PED-00000000-000', frontendUrl, nodeEnv).replace(
    /\?order=.*$/,
    '',
  );
}
