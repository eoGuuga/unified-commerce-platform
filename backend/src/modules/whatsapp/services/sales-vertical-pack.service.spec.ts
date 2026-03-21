import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesPlaybookService } from './sales-playbook.service';
import { SalesVerticalPackService } from './sales-vertical-pack.service';

describe('SalesVerticalPackService', () => {
  const messageIntelligenceService = new MessageIntelligenceService();
  const salesPlaybookService = new SalesPlaybookService(messageIntelligenceService);
  const service = new SalesVerticalPackService(messageIntelligenceService);

  it('keeps confectionery packs aligned with confectionery catalogs', () => {
    const playbook = salesPlaybookService.inferPlaybook([
      {
        id: 'p1',
        tenant_id: 'tenant-id',
        name: 'Brigadeiro Gourmet',
        description: 'Presente doce com boa apresentacao',
        price: 10.5,
        stock: 10,
        available_stock: 10,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Doces' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    const pack = service.buildPack(playbook, [
      {
        id: 'p1',
        tenant_id: 'tenant-id',
        name: 'Brigadeiro Gourmet',
        description: 'Presente doce com boa apresentacao',
        price: 10.5,
        stock: 10,
        available_stock: 10,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Doces' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    expect(pack.key).toBe('confectionery');
    expect(pack.label).toBe('confeitaria');
  });

  it('upgrades wellness-like catalogs into pharmacy packs when the catalog is pharmacy-heavy', () => {
    const playbook = salesPlaybookService.inferPlaybook([
      {
        id: 'ph1',
        tenant_id: 'tenant-id',
        name: 'Kit Farmacia com Termometro e Higiene',
        description: 'Item de farmacia para apoio de cuidado e rotina',
        price: 49.9,
        stock: 8,
        available_stock: 8,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Farmacia' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    const pack = service.buildPack(playbook, [
      {
        id: 'ph1',
        tenant_id: 'tenant-id',
        name: 'Kit Farmacia com Termometro e Higiene',
        description: 'Item de farmacia para apoio de cuidado e rotina',
        price: 49.9,
        stock: 8,
        available_stock: 8,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Farmacia' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    expect(pack.key).toBe('pharmacy');
    expect(pack.label).toBe('farmacia');
  });

  it('detects services packs from service-oriented catalogs', () => {
    const playbook = salesPlaybookService.inferPlaybook([
      {
        id: 's1',
        tenant_id: 'tenant-id',
        name: 'Pacote de Manutencao Mensal',
        description: 'Servico de assistencia e revisao com agendamento',
        price: 199.9,
        stock: 20,
        available_stock: 20,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Servicos' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    const pack = service.buildPack(playbook, [
      {
        id: 's1',
        tenant_id: 'tenant-id',
        name: 'Pacote de Manutencao Mensal',
        description: 'Servico de assistencia e revisao com agendamento',
        price: 199.9,
        stock: 20,
        available_stock: 20,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Servicos' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    expect(pack.key).toBe('services');
    expect(pack.label).toBe('servicos');
  });

  it('finds a complementary product when the catalog supports a vertical bundle', () => {
    const playbook = salesPlaybookService.inferPlaybook([
      {
        id: 'r1',
        tenant_id: 'tenant-id',
        name: 'Combo Executivo',
        description: 'Refeicao completa para almoco',
        price: 34.9,
        stock: 12,
        available_stock: 12,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Executivo' },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'r2',
        tenant_id: 'tenant-id',
        name: 'Suco Natural',
        description: 'Bebida leve para acompanhar refeicao',
        price: 9.9,
        stock: 10,
        available_stock: 10,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c2', name: 'Bebidas' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    const products = [
      {
        id: 'r1',
        tenant_id: 'tenant-id',
        name: 'Combo Executivo',
        description: 'Refeicao completa para almoco',
        price: 34.9,
        stock: 12,
        available_stock: 12,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Executivo' },
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'r2',
        tenant_id: 'tenant-id',
        name: 'Suco Natural',
        description: 'Bebida leve para acompanhar refeicao',
        price: 9.9,
        stock: 10,
        available_stock: 10,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c2', name: 'Bebidas' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any;

    const pack = service.buildPack(playbook, products);
    const crossSell = service.findCrossSellSuggestion(pack, products, [products[0]]);

    expect(crossSell?.product.name).toBe('Suco Natural');
    expect(crossSell?.reason).toContain('refeicao completa');
  });
});
