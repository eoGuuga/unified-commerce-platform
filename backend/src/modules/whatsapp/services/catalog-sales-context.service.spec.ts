import { ProductWithStock } from '../../products/types/product.types';
import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesIntelligenceService } from './sales-intelligence.service';
import { SalesPlaybookService } from './sales-playbook.service';
import { CatalogSalesContextService } from './catalog-sales-context.service';

describe('CatalogSalesContextService', () => {
  const messageIntelligenceService = new MessageIntelligenceService();
  const salesIntelligenceService = new SalesIntelligenceService(messageIntelligenceService);
  const salesPlaybookService = new SalesPlaybookService(messageIntelligenceService);
  const service = new CatalogSalesContextService(messageIntelligenceService);

  const chocolateCatalog: ProductWithStock[] = [
    {
      id: 'c1',
      tenant_id: 'tenant-id',
      name: 'Caixa Presenteavel de Brigadeiros',
      description: 'Chocolate gourmet com boa apresentacao para presente.',
      metadata: {
        sales_pitch: 'caixa premium para presentear sem erro',
        sales_tags: ['chocolate', 'presente', 'premium'],
      },
      price: 39.9,
      stock: 8,
      available_stock: 8,
      reserved_stock: 0,
      min_stock: 1,
      is_active: true,
      categoria: { id: 'cat-1', name: 'Presentes' },
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'c2',
      tenant_id: 'tenant-id',
      name: 'Trufa Avulsa',
      description: 'Mimo individual com chocolate intenso.',
      metadata: {
        sales_tags: ['chocolate', 'mimo individual'],
      },
      price: 8.5,
      stock: 12,
      available_stock: 12,
      reserved_stock: 0,
      min_stock: 1,
      is_active: true,
      categoria: { id: 'cat-2', name: 'Doces' },
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'c3',
      tenant_id: 'tenant-id',
      name: 'Bolo de Chocolate para Festa',
      description: 'Opcao para compartilhar em mesa e comemoracao.',
      metadata: {
        sales_tags: ['festa', 'compartilhar', 'chocolate'],
      },
      price: 64.9,
      stock: 5,
      available_stock: 5,
      reserved_stock: 0,
      min_stock: 1,
      is_active: true,
      categoria: { id: 'cat-3', name: 'Bolos' },
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  it('builds a chocolate-first catalog reading from configured products', () => {
    const playbook = salesPlaybookService.inferPlaybook(chocolateCatalog);
    const profile = service.buildProfile(chocolateCatalog, playbook);

    expect(profile.storeLabel).toBe('chocolates e doces');
    expect(profile.catalogReading).toContain('chocolates e doces');
    expect(profile.catalogReading).toContain('presente');
    expect(profile.qualificationQuestion).toContain('presente');
  });

  it('boosts products that match the configured catalog moments for gifting', () => {
    const playbook = salesPlaybookService.inferPlaybook(chocolateCatalog);
    const profile = service.buildProfile(chocolateCatalog, playbook);
    const analysis = salesIntelligenceService.analyze('me indica algo para presente');

    const giftFit = service.scoreProduct(chocolateCatalog[0], analysis, profile);
    const singleFit = service.scoreProduct(chocolateCatalog[1], analysis, profile);

    expect(giftFit.score).toBeGreaterThan(singleFit.score);
    expect(giftFit.reasons.join(' ')).toContain('presente');
  });

  it('builds a gift-ready focus line and qualification for box-style requests', () => {
    const playbook = salesPlaybookService.inferPlaybook(chocolateCatalog);
    const profile = service.buildProfile(chocolateCatalog, playbook);
    const analysis = salesIntelligenceService.analyze('me indica uma caixa caprichada para presente');

    expect(service.buildConversationFocusLine(profile, analysis)).toContain(
      'presente pronto para entregar',
    );
    expect(service.buildDynamicQualificationQuestion(profile, analysis)).toContain(
      'marcante na caixa',
    );
  });

  it('builds a chocolate-first qualification when the customer wants something more chocolatudo', () => {
    const playbook = salesPlaybookService.inferPlaybook(chocolateCatalog);
    const profile = service.buildProfile(chocolateCatalog, playbook);
    const analysis = salesIntelligenceService.analyze('quero algo mais chocolatudo e intenso');

    expect(service.buildConversationFocusLine(profile, analysis)).toContain(
      'bate mais forte em chocolate e desejo',
    );
    expect(service.buildDynamicQualificationQuestion(profile, analysis)).toContain(
      'mais intenso no chocolate',
    );
  });

  it('includes product metadata in the catalog search document', () => {
    const searchDocument = service.buildProductSearchDocument(chocolateCatalog[0]);

    expect(searchDocument).toContain('caixa premium para presentear sem erro');
    expect(searchDocument).toContain('presente');
  });
});
