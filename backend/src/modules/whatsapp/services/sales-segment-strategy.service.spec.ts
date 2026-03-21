import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesIntelligenceService } from './sales-intelligence.service';
import { SalesPlaybookService } from './sales-playbook.service';
import { SalesSegmentStrategyService } from './sales-segment-strategy.service';

describe('SalesSegmentStrategyService', () => {
  const messageIntelligenceService = new MessageIntelligenceService();
  const salesIntelligenceService = new SalesIntelligenceService(messageIntelligenceService);
  const salesPlaybookService = new SalesPlaybookService(messageIntelligenceService);
  const service = new SalesSegmentStrategyService(messageIntelligenceService);

  it('detects workwear strategy signals for fashion catalogs', () => {
    const playbook = salesPlaybookService.inferPlaybook([
      {
        id: 'f1',
        tenant_id: 'tenant-id',
        name: 'Blazer Alfaiataria Premium',
        description: 'Peca marcante para escritorio e reuniao',
        price: 199.9,
        stock: 4,
        available_stock: 4,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Moda Feminina' },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'f2',
        tenant_id: 'tenant-id',
        name: 'Camisa Social Versatil',
        description: 'Peca para trabalho e rotina profissional',
        price: 149.9,
        stock: 6,
        available_stock: 6,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c2', name: 'Roupas' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    const analysis = salesIntelligenceService.analyze('me indica um look para trabalho');
    const strategy = service.buildStrategy(playbook, analysis);

    expect(strategy.segment).toBe('fashion');
    expect(strategy.detectedNeeds.map((need) => need.label)).toContain('uso de trabalho');
    expect(strategy.clarifyPrompt).toContain('trabalho');
  });

  it('scores products using detected pet needs', () => {
    const playbook = salesPlaybookService.inferPlaybook([
      {
        id: 'p1',
        tenant_id: 'tenant-id',
        name: 'Petisco Natural Filhote',
        description: 'Snack para fase inicial do pet',
        price: 34.9,
        stock: 10,
        available_stock: 10,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Petiscos' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    const analysis = salesIntelligenceService.analyze(
      'me indica algo para cachorro filhote',
    );
    const strategy = service.buildStrategy(playbook, analysis);
    const fit = service.scoreProductForStrategy(
      {
        id: 'p1',
        tenant_id: 'tenant-id',
        name: 'Petisco Natural Filhote',
        description: 'Snack para fase inicial do pet',
        price: 34.9,
        stock: 10,
        available_stock: 10,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Petiscos' },
        created_at: new Date(),
        updated_at: new Date(),
      } as any,
      strategy,
    );

    expect(strategy.detectedNeeds.map((need) => need.label)).toEqual(
      expect.arrayContaining(['perfil de cachorro', 'filhote ou fase inicial']),
    );
    expect(fit.score).toBeGreaterThan(0);
    expect(fit.reasons.join(' ')).toContain('pet');
  });

  it('falls back to a discovery prompt when the need is still generic', () => {
    const playbook = salesPlaybookService.inferPlaybook([
      {
        id: 'e1',
        tenant_id: 'tenant-id',
        name: 'Carregador Turbo USB-C',
        description: 'Mais potencia para o dia a dia',
        price: 79.9,
        stock: 12,
        available_stock: 12,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Acessorios' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    const analysis = salesIntelligenceService.analyze('me recomenda algo bom');
    const strategy = service.buildStrategy(playbook, analysis);

    expect(strategy.detectedNeeds).toHaveLength(0);
    expect(strategy.clarifyPrompt).toContain('uso principal');
  });
});
