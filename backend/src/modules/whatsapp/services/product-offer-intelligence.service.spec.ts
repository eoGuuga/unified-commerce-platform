import { ProductWithStock } from '../../products/types/product.types';
import { MessageIntelligenceService } from './message-intelligence.service';
import { ProductOfferIntelligenceService } from './product-offer-intelligence.service';
import { SalesIntelligenceService } from './sales-intelligence.service';

describe('ProductOfferIntelligenceService', () => {
  const messageIntelligenceService = new MessageIntelligenceService();
  const salesIntelligenceService = new SalesIntelligenceService(messageIntelligenceService);
  const service = new ProductOfferIntelligenceService(messageIntelligenceService);

  const catalog: ProductWithStock[] = [
    {
      id: 'p1',
      tenant_id: 'tenant-id',
      name: 'Caixa presenteavel com 6 brigadeiros tradicionais',
      description: 'Caixa pronta para presentear com chocolate artesanal.',
      metadata: {
        sales_pitch: 'presente caprichado para acertar sem erro',
      },
      price: 26,
      stock: 10,
      available_stock: 10,
      reserved_stock: 0,
      min_stock: 1,
      is_active: true,
      categoria: { id: 'cat-1', name: 'Presentear' },
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'p2',
      tenant_id: 'tenant-id',
      name: 'Brigadeiro individual mimo',
      description: 'Mimo individual para uma vontade rapida.',
      price: 6,
      stock: 15,
      available_stock: 15,
      reserved_stock: 0,
      min_stock: 1,
      is_active: true,
      categoria: { id: 'cat-2', name: 'Presentear' },
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'p3',
      tenant_id: 'tenant-id',
      name: 'Cartao recadinho',
      description: 'Complemento simples para acompanhar um presente.',
      price: 2.5,
      stock: 30,
      available_stock: 30,
      reserved_stock: 0,
      min_stock: 1,
      is_active: true,
      categoria: { id: 'cat-3', name: 'Complementos' },
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  it('understands the commercial role of a gift-ready box', () => {
    const profile = service.analyzeProduct(catalog[0], catalog);

    expect(profile.role).toBe('gift_ready');
    expect(profile.useCases).toContain('presente');
  });

  it('understands when an item is mostly an accessory', () => {
    const profile = service.analyzeProduct(catalog[2], catalog);

    expect(profile.role).toBe('accessory');
  });

  it('scores a gift-ready item above a support accessory for gift conversations', () => {
    const analysis = salesIntelligenceService.analyze('me indica um presente sem erro');

    const giftFit = service.scoreProduct(catalog[0], catalog, analysis);
    const accessoryFit = service.scoreProduct(catalog[2], catalog, analysis);

    expect(giftFit.score).toBeGreaterThan(accessoryFit.score);
    expect(giftFit.reasons.join(' ')).toContain('presente');
  });

  it('boosts an impulse item for self-treat conversations', () => {
    const analysis = salesIntelligenceService.analyze('quero um mimo pra mim');
    const fit = service.scoreProduct(catalog[1], catalog, analysis);

    expect(fit.score).toBeGreaterThan(0);
    expect(fit.reasons.join(' ')).toContain('mimo');
  });
});
