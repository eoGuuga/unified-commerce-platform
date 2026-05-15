import { buildTrackingUrl, getOrdersPortalUrl } from './tracking-url';

describe('tracking-url', () => {
  describe('buildTrackingUrl', () => {
    it('usa FRONTEND_URL quando passada', () => {
      expect(
        buildTrackingUrl('PED-0001', 'https://app.exemplo.com'),
      ).toBe('https://app.exemplo.com/pedido?order=PED-0001');
    });

    it('remove trailing slashes do FRONTEND_URL', () => {
      expect(
        buildTrackingUrl('PED-0001', 'https://app.exemplo.com///'),
      ).toBe('https://app.exemplo.com/pedido?order=PED-0001');
    });

    it('fallback prod quando FRONTEND_URL ausente e NODE_ENV=production', () => {
      expect(buildTrackingUrl('PED-0001', undefined, 'production')).toBe(
        'https://gtsofthub.com.br/pedido?order=PED-0001',
      );
      expect(buildTrackingUrl('PED-0001', null, 'production')).toBe(
        'https://gtsofthub.com.br/pedido?order=PED-0001',
      );
      expect(buildTrackingUrl('PED-0001', '', 'production')).toBe(
        'https://gtsofthub.com.br/pedido?order=PED-0001',
      );
    });

    it('fallback dev quando FRONTEND_URL ausente e NODE_ENV!=production', () => {
      expect(buildTrackingUrl('PED-0001', '', 'development')).toBe(
        'http://localhost:3000/pedido?order=PED-0001',
      );
      expect(buildTrackingUrl('PED-0001', '', '')).toBe(
        'http://localhost:3000/pedido?order=PED-0001',
      );
    });

    it('url-encoda o orderNo com caracteres especiais', () => {
      expect(buildTrackingUrl('PED 0001/x', 'https://x.com')).toBe(
        'https://x.com/pedido?order=PED%200001%2Fx',
      );
    });
  });

  describe('getOrdersPortalUrl', () => {
    it('retorna a URL sem query string', () => {
      expect(getOrdersPortalUrl('https://app.exemplo.com')).toBe(
        'https://app.exemplo.com/pedido',
      );
    });

    it('respeita fallback prod sem FRONTEND_URL', () => {
      expect(getOrdersPortalUrl(undefined, 'production')).toBe(
        'https://gtsofthub.com.br/pedido',
      );
    });
  });
});
