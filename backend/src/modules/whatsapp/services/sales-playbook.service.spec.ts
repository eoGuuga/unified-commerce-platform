import { MessageIntelligenceService } from './message-intelligence.service';
import { SalesPlaybookService } from './sales-playbook.service';

describe('SalesPlaybookService', () => {
  const messageIntelligenceService = new MessageIntelligenceService();
  const service = new SalesPlaybookService(messageIntelligenceService);

  it('infers confectionery playbook from candy-focused catalogs', () => {
    const playbook = service.inferPlaybook([
      {
        id: 'p1',
        tenant_id: 'tenant-id',
        name: 'Brigadeiro Gourmet',
        description: 'Doce gourmet para presente',
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
      {
        id: 'p2',
        tenant_id: 'tenant-id',
        name: 'Brownie Premium',
        description: 'Brownie intenso com chocolate',
        price: 14.9,
        stock: 8,
        available_stock: 8,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Sobremesas' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    expect(playbook.segment).toBe('confectionery');
    expect(playbook.label).toBe('confeitaria');
  });

  it('infers fashion playbook from apparel catalogs', () => {
    const playbook = service.inferPlaybook([
      {
        id: 'f1',
        tenant_id: 'tenant-id',
        name: 'Vestido Premium',
        description: 'Peca marcante para noite',
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
        name: 'Camiseta Basica',
        description: 'Malha leve e versatil para dia a dia',
        price: 59.9,
        stock: 12,
        available_stock: 12,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c2', name: 'Roupas' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    expect(playbook.segment).toBe('fashion');
    expect(playbook.salesLens).toContain('look');
  });

  it('infers pet playbook from pet-focused catalogs', () => {
    const playbook = service.inferPlaybook([
      {
        id: 'pet1',
        tenant_id: 'tenant-id',
        name: 'Racao Premium Porte Medio',
        description: 'Nutricao equilibrada para pet adulto',
        price: 129.9,
        stock: 6,
        available_stock: 6,
        reserved_stock: 0,
        min_stock: 1,
        is_active: true,
        categoria: { id: 'c1', name: 'Pet' },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ] as any);

    expect(playbook.segment).toBe('pet');
    expect(playbook.comparisonLabels.betterValue).toBe('Melhor rotina do pet');
  });
});
