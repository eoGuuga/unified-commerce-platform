import * as fs from 'fs';
import * as path from 'path';
import { ProductWithStock } from '../../products/types/product.types';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesPlaybookService } from './sales-playbook.service';
import { CatalogSalesContextService } from './catalog-sales-context.service';
import { buildClientCatalogMetadata, deriveClientCatalogSalesTags } from './client-catalog-metadata';

type HomologationCatalog = {
  produtos: Record<string, Array<{
    name: string;
    description?: string;
    price: number;
    categoria: string;
    unit?: string;
    estoque: number;
    min_stock: number;
    metadata?: Record<string, unknown>;
  }>>;
};

function loadLoucasCatalog(): ProductWithStock[] {
  const filePath = path.resolve(
    __dirname,
    '../../../../../scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json',
  );
  const raw = fs.readFileSync(filePath, 'utf8');
  const catalog = JSON.parse(raw) as HomologationCatalog;

  return Object.entries(catalog.produtos).flatMap(([categorySlug, products], categoryIndex) =>
    products.map((product, productIndex) => ({
      id: `${categorySlug}-${productIndex + 1}`,
      tenant_id: 'tenant-loucas',
      name: product.name,
      description: product.description,
      metadata: buildClientCatalogMetadata(
        product,
        {
          fonte: 'https://menudireto.com/loucas-por-brigadeiro/#12',
          loja: {
            slug: 'loucas-por-brigadeiro',
            restauranteN: 756,
          },
        },
        'test-import',
      ),
      price: product.price,
      unit: product.unit || 'unidade',
      is_active: true,
      stock: product.estoque,
      available_stock: product.estoque,
      reserved_stock: 0,
      min_stock: product.min_stock,
      categoria: {
        id: `cat-${categoryIndex + 1}`,
        name: product.categoria,
      },
      created_at: new Date(),
      updated_at: new Date(),
    })),
  );
}

describe('CatalogSalesContextService with Loucas Por Brigadeiro catalog', () => {
  const messageIntelligenceService = new MessageIntelligenceService();
  const salesPlaybookService = new SalesPlaybookService(messageIntelligenceService);
  const catalogSalesContextService = new CatalogSalesContextService(messageIntelligenceService);
  const products = loadLoucasCatalog();

  it('recognizes the real catalog as confectionery-first', () => {
    const playbook = salesPlaybookService.inferPlaybook(products);
    const profile = catalogSalesContextService.buildProfile(products, playbook);

    expect(playbook.segment).toBe('confectionery');
    expect(profile.catalogReading).toContain('chocolates e doces');
    expect(profile.focusThemes.some((theme) => theme.key === 'chocolate')).toBe(true);
  });

  it('builds gift-oriented metadata for the real presentear items', () => {
    const giftProduct = products.find((product) =>
      /caixa|kit doce|bomboniere|presente/i.test(product.name),
    );

    expect(giftProduct).toBeDefined();
    expect(deriveClientCatalogSalesTags({
      name: giftProduct!.name,
      description: giftProduct!.description,
      categoria: giftProduct!.categoria?.name || '',
      metadata: giftProduct!.metadata,
    })).toContain('presente');
    expect(String(giftProduct!.metadata?.whatsapp_hint || '')).toContain('present');
    expect(String(giftProduct!.metadata?.sales_pitch || '')).toContain('presente');
  });
});
