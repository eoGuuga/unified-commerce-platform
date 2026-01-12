import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Produto } from '../../database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CacheService } from '../common/services/cache.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { DbContextService } from '../common/services/db-context.service';
import { PaginationDto } from './dto/pagination.dto';

describe('ProductsService', () => {
  let service: ProductsService;
  let produtosRepository: Repository<Produto>;
  let estoquesRepository: Repository<MovimentacaoEstoque>;

  const mockProdutosRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEstoquesRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCacheService = {
    getCachedProducts: jest.fn().mockResolvedValue(null),
    cacheProducts: jest.fn().mockResolvedValue(undefined),
    invalidateProductsCache: jest.fn().mockResolvedValue(undefined),
    invalidateStockCache: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockDbContextService = {
    getRepository: jest.fn((entity) => {
      if (entity === Produto) return mockProdutosRepository;
      if (entity === MovimentacaoEstoque) return mockEstoquesRepository;
      return {};
    }),
    runInTransaction: jest.fn(async (callback) => callback(mockDataSource)),
  };

  const mockDataSource = {
    // ProductsService usa DataSource em alguns métodos, mas estes unit tests não dependem dele.
    transaction: jest.fn(async (cb: any) => cb({})),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Produto),
          useValue: mockProdutosRepository,
        },
        {
          provide: getRepositoryToken(MovimentacaoEstoque),
          useValue: mockEstoquesRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: DbContextService,
          useValue: mockDbContextService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    produtosRepository = module.get<Repository<Produto>>(getRepositoryToken(Produto));
    estoquesRepository = module.get<Repository<MovimentacaoEstoque>>(getRepositoryToken(MovimentacaoEstoque));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const userId = 'user-id';
    const createProductDto: CreateProductDto = {
      name: 'Test Product',
      price: 10.5,
      description: 'Test description',
      unit: 'unidade',
    };

    const mockProduto: Partial<Produto> = {
      id: 'product-id',
      tenant_id: tenantId,
      name: createProductDto.name,
      price: createProductDto.price,
      description: createProductDto.description,
      unit: createProductDto.unit,
      is_active: true,
    } as Produto;

    it('deve criar produto com sucesso', async () => {
      // Arrange
      mockProdutosRepository.create.mockReturnValue(mockProduto);
      mockProdutosRepository.save.mockResolvedValue(mockProduto);
      mockEstoquesRepository.create.mockReturnValue({ id: 'stock-id' });
      mockEstoquesRepository.save.mockResolvedValue({ id: 'stock-id' });

      // Act
      const result = await service.create(createProductDto, tenantId, userId, '127.0.0.1', 'Test Agent');

      // Assert
      expect(result).toEqual(mockProduto);
      expect(mockProdutosRepository.create).toHaveBeenCalled();
      expect(mockProdutosRepository.save).toHaveBeenCalled();
      expect(mockCacheService.invalidateProductsCache).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('findAll', () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const mockProdutos: Partial<Produto>[] = [
      { id: '1', name: 'Product 1', price: 10 } as Produto,
      { id: '2', name: 'Product 2', price: 20 } as Produto,
    ];

    const mockProdutosComEstoque = mockProdutos.map((p) => ({
      ...p,
      stock: 10,
      available_stock: 10,
      reserved_stock: 0,
      min_stock: 5,
    }));

    it('deve retornar lista de produtos sem paginação', async () => {
      // Arrange
      mockCacheService.getCachedProducts.mockResolvedValue(null);
      
      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as unknown as SelectQueryBuilder<MovimentacaoEstoque>;

      const produtoQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      } as unknown as SelectQueryBuilder<Produto>;

      jest.spyOn(produtosRepository, 'createQueryBuilder').mockReturnValue(produtoQueryBuilder);
      jest.spyOn(estoquesRepository, 'createQueryBuilder').mockReturnValue(estoqueQueryBuilder);

      // Act
      const result = await service.findAll(tenantId);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(mockCacheService.getCachedProducts).toHaveBeenCalledWith(tenantId);
      expect(mockCacheService.cacheProducts).toHaveBeenCalled();
    });

    it('deve retornar produtos do cache quando disponível', async () => {
      // Arrange
      mockCacheService.getCachedProducts.mockResolvedValue(mockProdutosComEstoque);

      // Act
      const result = await service.findAll(tenantId);

      // Assert
      expect(result).toEqual(mockProdutosComEstoque);
      expect(produtosRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('deve retornar resultado paginado quando paginação fornecida', async () => {
      // Arrange
      const pagination: PaginationDto = { page: 1, limit: 10 };
      mockCacheService.getCachedProducts.mockResolvedValue(null);

      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as unknown as SelectQueryBuilder<MovimentacaoEstoque>;

      const produtoQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockProdutos, 2]),
      } as unknown as SelectQueryBuilder<Produto>;

      jest.spyOn(produtosRepository, 'createQueryBuilder').mockReturnValue(produtoQueryBuilder);
      jest.spyOn(estoquesRepository, 'createQueryBuilder').mockReturnValue(estoqueQueryBuilder);

      // Act
      const result = await service.findAll(tenantId, pagination);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });
  });

  describe('findOne', () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const productId = 'product-id';
    const mockProduto: Partial<Produto> = {
      id: productId,
      tenant_id: tenantId,
      name: 'Test Product',
    } as Produto;

    it('deve retornar produto quando encontrado', async () => {
      // Arrange
      mockProdutosRepository.findOne.mockResolvedValue(mockProduto);

      // Act
      const result = await service.findOne(productId, tenantId);

      // Assert
      expect(result).toEqual(mockProduto);
      expect(mockProdutosRepository.findOne).toHaveBeenCalledWith({
        where: { id: productId, tenant_id: tenantId },
        relations: ['categoria'],
      });
    });

    it('deve lançar NotFoundException quando produto não encontrado', async () => {
      // Arrange
      mockProdutosRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(productId, tenantId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const userId = 'user-id';
    const productId = 'product-id';
    const updateProductDto: UpdateProductDto = {
      name: 'Updated Product',
      price: 15.0,
    };

    const mockProduto: Partial<Produto> = {
      id: productId,
      tenant_id: tenantId,
      name: 'Original Product',
      price: 10.0,
      is_active: true,
    } as Produto;

    const mockUpdatedProduto: Partial<Produto> = {
      ...mockProduto,
      ...updateProductDto,
    } as Produto;

    it('deve atualizar produto com sucesso', async () => {
      // Arrange
      mockProdutosRepository.findOne.mockResolvedValue(mockProduto);
      mockProdutosRepository.save.mockResolvedValue(mockUpdatedProduto);

      // Act
      const result = await service.update(
        productId,
        updateProductDto,
        tenantId,
        userId,
        '127.0.0.1',
        'Test Agent',
      );

      // Assert
      expect(result).toEqual(mockUpdatedProduto);
      expect(mockProdutosRepository.save).toHaveBeenCalled();
      expect(mockCacheService.invalidateProductsCache).toHaveBeenCalledWith(tenantId);
    });

    it('deve lançar NotFoundException quando produto não encontrado', async () => {
      // Arrange
      mockProdutosRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(productId, updateProductDto, tenantId, userId, '127.0.0.1', 'Test Agent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
