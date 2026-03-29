import * as fs from 'fs';
import * as path from 'path';
import { ProductWithStock } from '../../products/types/product.types';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesIntelligenceService } from './sales-intelligence.service';
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
  const salesIntelligenceService = new SalesIntelligenceService(messageIntelligenceService);
  const salesPlaybookService = new SalesPlaybookService(messageIntelligenceService);
  const catalogSalesContextService = new CatalogSalesContextService(messageIntelligenceService);
  const products = loadLoucasCatalog();

  it('recognizes the real catalog as confectionery-first', () => {
    const playbook = salesPlaybookService.inferPlaybook(products);
    const profile = catalogSalesContextService.buildProfile(products, playbook);

    expect(playbook.segment).toBe('confectionery');
    expect(profile.storePersona).toBe('loucas_brigadeiro');
    expect(profile.storeLabel).toBe('brigadeiros, sobremesas cremosas e presentes');
    expect(profile.catalogReading).toContain('hoje a Loucas gira em brigadeiros, sobremesas cremosas e presentes');
    expect(profile.catalogReading).toContain('brigadeiro');
    expect(profile.catalogReading).toContain('sobremesa cremosa');
    expect(profile.focusThemes.some((theme) => theme.key === 'chocolate')).toBe(true);
    expect(profile.qualificationQuestion).toContain('brigadeiro e docinho');
    expect(profile.qualificationQuestion).toContain('banoffe e bolo no pote');
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

  it('guides creamy dessert conversations with a Loucas-specific question', () => {
    const playbook = salesPlaybookService.inferPlaybook(products);
    const profile = catalogSalesContextService.buildProfile(products, playbook);
    const salesAnalysis = salesIntelligenceService.analyze('quero uma sobremesa cremosa pra agora');

    const question = catalogSalesContextService.buildDynamicQualificationQuestion(profile, salesAnalysis);

    expect(question).toContain('sobremesa mais cremosa');
    expect(question).not.toContain('mimo individual');
  });

  it('prioritizes Loucas creamy desserts when the customer asks for something creamy', () => {
    const playbook = salesPlaybookService.inferPlaybook(products);
    const profile = catalogSalesContextService.buildProfile(products, playbook);
    const analysis = salesIntelligenceService.analyze('quero uma sobremesa cremosa pra agora');

    const banoffe = products.find((product) => /banoffe/i.test(product.name));
    const brigadeiro = products.find((product) => /brigadeiro/i.test(product.name));

    expect(banoffe).toBeDefined();
    expect(brigadeiro).toBeDefined();

    const banoffeFit = catalogSalesContextService.scoreProduct(banoffe!, analysis, profile);
    const brigadeiroFit = catalogSalesContextService.scoreProduct(brigadeiro!, analysis, profile);

    expect(banoffeFit.score).toBeGreaterThan(brigadeiroFit.score);
    expect(banoffeFit.reasons.join(' ')).toContain('sobremesas cremosas da Loucas');
  });

  it('pushes generic docinhos down when the customer clearly wants a creamy dessert', () => {
    const playbook = salesPlaybookService.inferPlaybook(products);
    const profile = catalogSalesContextService.buildProfile(products, playbook);
    const analysis = salesIntelligenceService.analyze('quero uma sobremesa cremosa pra agora');

    const banoffe = products.find((product) => /banoffe/i.test(product.name));
    const beijinho = products.find((product) => /beijinho/i.test(product.name));

    expect(banoffe).toBeDefined();
    expect(beijinho).toBeDefined();

    const banoffeFit = catalogSalesContextService.scoreProduct(banoffe!, analysis, profile);
    const beijinhoFit = catalogSalesContextService.scoreProduct(beijinho!, analysis, profile);

    expect(banoffeFit.score).toBeGreaterThan(beijinhoFit.score);
  });
});
