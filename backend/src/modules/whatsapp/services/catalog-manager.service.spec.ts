import { Test, TestingModule } from '@nestjs/testing';
import { CatalogManagerService } from './catalog-manager.service';
import { ProductsService } from '../../products/products.service';

describe('CatalogManagerService', () => {
  let service: CatalogManagerService;
  let mockProductsService: any;

  // Shape REAL que o CatalogManager lê (entidade Produto = inglês): name/price +
  // available_stock (o campo de estoque do ProductWithStock). O mock antigo usava
  // nome/preco/estoque (PT, desatualizado) → "undefined - R$ NaN" e nome undefined.
  const mockProducts: any[] = [
    { id: '1', name: 'Brigadeiro', price: 5, available_stock: 10 },
    { id: '2', name: 'Beijinho', price: 5, available_stock: 8 },
    { id: '3', name: 'Cascão', price: 5, available_stock: 0 },
    { id: '4', name: 'Ninho', price: 6, available_stock: 5 },
  ];

  beforeEach(async () => {
    // getCatalogProducts chama productsService.findAll (nao findAllWithStock).
    mockProductsService = {
      findAll: jest.fn().mockResolvedValue(mockProducts),
      findOne: jest.fn(),
      search: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogManagerService,
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<CatalogManagerService>(CatalogManagerService);
  });

  describe('getCatalogProducts', () => {
    it('should return all products with stock', async () => {
      const products = await service.getCatalogProducts('tenant-1');

      expect(products).toHaveLength(4);
      expect(mockProductsService.findAll).toHaveBeenCalledWith('tenant-1');
    });

    it('should return empty array on error', async () => {
      mockProductsService.findAll.mockRejectedValue(new Error('DB error'));

      const products = await service.getCatalogProducts('tenant-1');

      expect(products).toHaveLength(0);
    });
  });

  describe('findSimilarProducts', () => {
    it('should find similar products based on tokens', () => {
      const similar = service.findSimilarProducts(mockProducts, '1');

      expect(similar.length).toBeGreaterThan(0);
      expect(similar.some((p) => p.id === '2')).toBe(true); // Beijinho is similar to Brigadeiro
    });

    it('should exclude the source product', () => {
      const similar = service.findSimilarProducts(mockProducts, '1');

      expect(similar.some((p) => p.id === '1')).toBe(false);
    });

    it('should exclude out of stock products', () => {
      const similar = service.findSimilarProducts(mockProducts, '1');

      expect(similar.some((p) => p.id === '3')).toBe(false); // Cascão is out of stock
    });
  });

  describe('parseCatalogSelection', () => {
    it('should parse page navigation', () => {
      const result = service.parseCatalogSelection('2')!;

      expect(result.type).toBe('root_page');
      expect(result.page).toBe(2);
    });

    it('should parse "pagina 3" format', () => {
      const result = service.parseCatalogSelection('pagina 3')!;

      expect(result.type).toBe('root_page');
      expect(result.page).toBe(3);
    });

    it('should parse back command', () => {
      const result = service.parseCatalogSelection('voltar')!;

      expect(result.type).toBe('root');
      expect(result.page).toBe(1);
    });

    it('should parse "menu" command', () => {
      const result = service.parseCatalogSelection('menu')!;

      expect(result.type).toBe('root');
    });

    it('should parse product selection', () => {
      const result = service.parseCatalogSelection('brigadeiro')!;

      expect(result.type).toBe('product');
      expect(result.key).toBe('brigadeiro');
    });
  });

  describe('isCatalogCommand', () => {
    it('should detect catalog commands', () => {
      expect(service.isCatalogCommand('cardápio')).toBe(true);
      expect(service.isCatalogCommand('ver cardápio')).toBe(true);
      expect(service.isCatalogCommand('catálogo')).toBe(true);
      expect(service.isCatalogCommand('o que tem')).toBe(true);
    });

    it('should not detect regular messages as commands', () => {
      expect(service.isCatalogCommand('Brigadeiros')).toBe(false);
      expect(service.isCatalogCommand('Quero brigadeiros')).toBe(false);
    });
  });

  describe('extractCatalogQuery', () => {
    it('should extract search query', () => {
      const query = service.extractCatalogQuery('procura brigadeiro gourmet');

      expect(query).toBe('brigadeiro gourmet');
    });

    it('should extract "tem" query', () => {
      const query = service.extractCatalogQuery('tem brigadeiro de ninho');

      expect(query).toBe('brigadeiro de ninho');
    });

    it('should return null for non-search messages', () => {
      const query = service.extractCatalogQuery('Quero brigadeiros');

      expect(query).toBeNull();
    });
  });

  describe('formatProductHeadline', () => {
    it('should format product with price', () => {
      const headline = service.formatProductHeadline(mockProducts[0]);

      expect(headline).toContain('Brigadeiro');
      expect(headline).toContain('R$ 5,00');
    });

    it('should indicate low stock', () => {
      const headline = service.formatProductHeadline(mockProducts[3]);

      expect(headline).toContain('5)'); // Only 5 left
    });

    it('should indicate out of stock', () => {
      const headline = service.formatProductHeadline(mockProducts[2]);

      expect(headline).toContain('Esgotado');
    });
  });

  describe('isProductAvailable', () => {
    it('should return true for products with stock', () => {
      expect(service.isProductAvailable(mockProducts[0])).toBe(true);
    });

    it('should return false for out of stock products', () => {
      expect(service.isProductAvailable(mockProducts[2])).toBe(false);
    });
  });
});