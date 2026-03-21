import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { ItemPedido } from '../../database/entities/ItemPedido.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { Produto } from '../../database/entities/Produto.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CanalVenda } from '../../database/entities/Pedido.entity';
import { IdempotencyService } from '../common/services/idempotency.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DbContextService } from '../common/services/db-context.service';
import { CouponsService } from '../coupons/coupons.service';
import { CacheService } from '../common/services/cache.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockPedidoRepository = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockItensRepository = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn(),
  };

  const mockProdutosRepository = {
    find: jest.fn(),
  };

  const mockManager = {
    createQueryBuilder: jest.fn(),
    create: jest.fn((_entity, data) => data),
    save: jest.fn(async (data) => data),
    getRepository: jest.fn((entity) => {
      if (entity === Pedido) return mockPedidoRepository;
      if (entity === ItemPedido) return mockItensRepository;
      if (entity === Produto) return mockProdutosRepository;
      return {};
    }),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockIdempotencyService = {
    checkAndSet: jest.fn().mockResolvedValue(null),
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationsService = {
    notifyOrderStatusChange: jest.fn().mockResolvedValue(undefined),
    notifyPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
    notifyPaymentPending: jest.fn().mockResolvedValue(undefined),
  };

  const mockDbContextService = {
    getRepository: jest.fn((entity) => {
      if (entity === Pedido) return mockPedidoRepository;
      if (entity === ItemPedido) return mockItensRepository;
      if (entity === Produto) return mockProdutosRepository;
      return {};
    }),
    runInTransaction: jest.fn(async (callback) => {
      return callback(mockManager);
    }),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    deletePattern: jest.fn(),
    cacheProducts: jest.fn(),
    getCachedProducts: jest.fn(),
    invalidateProductsCache: jest.fn(),
    cacheStock: jest.fn(),
    getCachedStock: jest.fn(),
    invalidateStockCache: jest.fn(),
  };

  const mockCouponsService = {
    findActiveByCode: jest.fn().mockResolvedValue(null),
    validateCoupon: jest.fn().mockReturnValue({ valid: false, reason: 'Cupom não encontrado' }),
    computeDiscount: jest.fn().mockReturnValue(0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Pedido),
          useValue: mockPedidoRepository,
        },
        {
          provide: getRepositoryToken(ItemPedido),
          useValue: mockItensRepository,
        },
        {
          provide: getRepositoryToken(Produto),
          useValue: mockProdutosRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: DbContextService,
          useValue: mockDbContextService,
        },
        {
          provide: CouponsService,
          useValue: mockCouponsService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const produtoId1 = '11111111-1111-1111-1111-111111111111';
    const produtoId2 = '22222222-2222-2222-2222-222222222222';

    const createOrderDto: CreateOrderDto = {
      channel: CanalVenda.PDV,
      customer_name: 'João Silva',
      items: [
        {
          produto_id: produtoId1,
          quantity: 5,
          unit_price: 10.5,
        },
        {
          produto_id: produtoId2,
          quantity: 3,
          unit_price: 20.0,
        },
      ],
      discount_amount: 0,
      shipping_amount: 0,
    };

    const mockEstoques: Partial<MovimentacaoEstoque>[] = [
      {
        id: 'estoque1',
        tenant_id: tenantId,
        produto_id: produtoId1,
        current_stock: 50,
        reserved_stock: 2,
        min_stock: 10,
        last_updated: new Date(),
      },
      {
        id: 'estoque2',
        tenant_id: tenantId,
        produto_id: produtoId2,
        current_stock: 30,
        reserved_stock: 0,
        min_stock: 5,
        last_updated: new Date(),
      },
    ] as MovimentacaoEstoque[];

    const mockProdutos: Partial<Produto>[] = [
      {
        id: produtoId1,
        tenant_id: tenantId,
        is_active: true,
        price: 10.5,
      },
      {
        id: produtoId2,
        tenant_id: tenantId,
        is_active: true,
        price: 20.0,
      },
    ] as Produto[];

    const mockPedido: Partial<Pedido> = {
      id: 'pedido-id',
      tenant_id: tenantId,
      order_no: 'PED-20260107-001',
      status: PedidoStatus.PENDENTE_PAGAMENTO,
      channel: CanalVenda.PDV,
      customer_name: 'João Silva',
      subtotal: 112.5,
      discount_amount: 0,
      shipping_amount: 0,
      total_amount: 112.5,
      created_at: new Date(),
      updated_at: new Date(),
    } as Pedido;

    it('deve criar pedido com sucesso quando há estoque suficiente', async () => {
      // Arrange
      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEstoques),
      };

      const produtosQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      };

      const updateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn((entity) => {
        if (entity === MovimentacaoEstoque) return estoqueQueryBuilder as any;
        if (entity === Produto) return produtosQueryBuilder as any;
        return updateQueryBuilder as any;
      });
      mockManager.create = jest.fn().mockReturnValue(mockPedido);
      mockManager.save = jest.fn().mockResolvedValue(mockPedido);

      // ✅ OrdersService agora usa db.runInTransaction, não dataSource.transaction
      mockDbContextService.runInTransaction = jest.fn(async (callback) => {
        return callback(mockManager);
      });

      jest.spyOn(service as any, 'generateOrderNumber').mockResolvedValue('PED-20260107-001');

      // Act
      const result = await service.create(createOrderDto, tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.total_amount).toBe(112.5); // (5 * 10.5) + (3 * 20.0) = 52.5 + 60 = 112.5
      expect(result.status).toBe(PedidoStatus.PENDENTE_PAGAMENTO);
      expect(mockDbContextService.runInTransaction).toHaveBeenCalled();
      expect(estoqueQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(estoqueQueryBuilder.getMany).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando produto não tem estoque cadastrado', async () => {
      // Arrange
      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEstoques[0]]), // Apenas um estoque (faltará um produto)
      };

      const produtosQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      };

      const updateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn((entity) => {
        // 1) MovimentacaoEstoque -> getMany retorna estoques
        if (entity === MovimentacaoEstoque) {
          return estoqueQueryBuilder as any;
        }
        // 2) Produto -> getMany retorna produtos ativos
        if (entity === Produto) {
          return produtosQueryBuilder as any;
        }
        return updateQueryBuilder as any;
      });

      // ✅ OrdersService agora usa db.runInTransaction
      mockDbContextService.runInTransaction = jest.fn(async (callback) => {
        try {
          return await callback(mockManager);
        } catch (error) {
          throw error;
        }
      });

      // Act & Assert
      await expect(service.create(createOrderDto, tenantId)).rejects.toThrow(NotFoundException);
      await expect(service.create(createOrderDto, tenantId)).rejects.toThrow(
        `Produto ${produtoId2} sem estoque cadastrado`,
      );
    });

    it('deve lançar BadRequestException quando estoque insuficiente', async () => {
      // Arrange
      const estoquesInsuficientes: Partial<MovimentacaoEstoque>[] = [
        {
          ...mockEstoques[0],
          current_stock: 3, // Menos do que necessário (5)
          reserved_stock: 0,
        },
        mockEstoques[1],
      ] as MovimentacaoEstoque[];

      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(estoquesInsuficientes),
      };

      const produtosQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      };

      const updateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn((entity) => {
        if (entity === MovimentacaoEstoque) return estoqueQueryBuilder as any;
        if (entity === Produto) return produtosQueryBuilder as any;
        return updateQueryBuilder as any;
      });
      mockDbContextService.runInTransaction = jest.fn(async (callback) => {
        return callback(mockManager);
      });

      // Act & Assert
      const createPromise = service.create(createOrderDto, tenantId);
      await expect(createPromise).rejects.toThrow(BadRequestException);
      await expect(createPromise).rejects.toThrow('Estoque insuficiente');
    });

    it('deve permitir fechar pedido consumindo a reserva do proprio PDV', async () => {
      // Arrange
      const estoquesComReserva: Partial<MovimentacaoEstoque>[] = [
        {
          ...mockEstoques[0],
          current_stock: 5,
          reserved_stock: 6, // Estoque disponível = 10 - 6 = 4, mas precisa de 5
        },
        mockEstoques[1],
      ] as MovimentacaoEstoque[];

      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(estoquesComReserva),
      };

      const produtosQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      };

      const updateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn((entity) => {
        if (entity === MovimentacaoEstoque) return estoqueQueryBuilder as any;
        if (entity === Produto) return produtosQueryBuilder as any;
        return updateQueryBuilder as any;
      });

      // ✅ OrdersService agora usa db.runInTransaction
      mockDbContextService.runInTransaction = jest.fn(async (callback) => {
        return callback(mockManager);
      });

      jest.spyOn(service as any, 'generateOrderNumber').mockResolvedValue('PED-20260107-001');

      // Act
      const result = await service.create(createOrderDto, tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe(PedidoStatus.PENDENTE_PAGAMENTO);
      expect(updateQueryBuilder.setParameters).toHaveBeenCalled();
    });

    it('deve falhar se o abate atomico de estoque nao conseguir atualizar a linha', async () => {
      // Arrange
      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEstoques),
      };

      const produtosQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      };

      const updateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest
          .fn()
          .mockResolvedValueOnce({ affected: 1 })
          .mockResolvedValueOnce({ affected: 0 }),
      };

      mockManager.createQueryBuilder = jest.fn((entity) => {
        if (entity === MovimentacaoEstoque) return estoqueQueryBuilder as any;
        if (entity === Produto) return produtosQueryBuilder as any;
        return updateQueryBuilder as any;
      });

      mockDbContextService.runInTransaction = jest.fn(async (callback) => {
        return callback(mockManager);
      });

      // Act & Assert
      const createPromise = service.create(createOrderDto, tenantId);
      await expect(createPromise).rejects.toThrow(BadRequestException);
      await expect(createPromise).rejects.toThrow('Estoque insuficiente');
    });

    it('deve calcular totais corretamente com desconto e frete', async () => {
      // Arrange
      const orderComDesconto: CreateOrderDto = {
        ...createOrderDto,
        coupon_code: 'CUPOM10',
        discount_amount: 10.0,
        shipping_amount: 5.0,
      };

      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEstoques),
      };

      const produtosQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      };

      const updateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn((entity) => {
        if (entity === MovimentacaoEstoque) return estoqueQueryBuilder as any;
        if (entity === Produto) return produtosQueryBuilder as any;
        return updateQueryBuilder as any;
      });

      mockCouponsService.findActiveByCode.mockResolvedValueOnce({
        id: 'coupon-id',
        tenant_id: tenantId,
        code: 'CUPOM10',
        is_active: true,
      });
      mockCouponsService.validateCoupon.mockReturnValueOnce({
        valid: true,
        discountAmount: 10.0,
        code: 'CUPOM10',
      });

      const pedidoComDesconto = {
        ...mockPedido,
        subtotal: 112.5,
        discount_amount: 10.0,
        shipping_amount: 5.0,
        total_amount: 107.5, // 112.5 - 10 + 5
      };
      mockManager.create = jest.fn().mockReturnValue(pedidoComDesconto);
      mockManager.save = jest.fn().mockResolvedValue(pedidoComDesconto);

      // ✅ OrdersService agora usa db.runInTransaction
      mockDbContextService.runInTransaction = jest.fn(async (callback) => {
        return callback(mockManager);
      });

      jest.spyOn(service as any, 'generateOrderNumber').mockResolvedValue('PED-20260107-001');

      // Act
      const result = await service.create(orderComDesconto, tenantId);

      // Assert
      expect(result.subtotal).toBe(112.5);
      expect(result.discount_amount).toBe(10.0);
      expect(result.shipping_amount).toBe(5.0);
      expect(result.total_amount).toBe(107.5); // 112.5 - 10 + 5
    });

    it('deve definir status correto baseado no canal (sempre PENDENTE_PAGAMENTO)', async () => {
      // Arrange
      const estoqueQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEstoques),
      };

      const produtosQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProdutos),
      };

      const updateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn((entity) => {
        if (entity === MovimentacaoEstoque) return estoqueQueryBuilder as any;
        if (entity === Produto) return produtosQueryBuilder as any;
        return updateQueryBuilder as any;
      });
      mockManager.create = jest.fn().mockReturnValue(mockPedido);
      mockManager.save = jest.fn().mockResolvedValue(mockPedido);

      // ✅ OrdersService agora usa db.runInTransaction
      mockDbContextService.runInTransaction = jest.fn(async (callback) => {
        return callback(mockManager);
      });

      jest.spyOn(service as any, 'generateOrderNumber').mockResolvedValue('PED-20260107-001');

      // Test PDV
      const resultPDV = await service.create(createOrderDto, tenantId);
      expect(resultPDV.status).toBe(PedidoStatus.PENDENTE_PAGAMENTO);

      // Test E-commerce
      const orderEcommerce = { ...createOrderDto, channel: CanalVenda.ECOMMERCE };
      const pedidoEcommerce = { ...mockPedido, status: PedidoStatus.PENDENTE_PAGAMENTO };
      mockManager.create = jest.fn().mockReturnValue(pedidoEcommerce);
      mockManager.save = jest.fn().mockResolvedValue(pedidoEcommerce);

      const resultEcommerce = await service.create(orderEcommerce, tenantId);
      expect(resultEcommerce.status).toBe(PedidoStatus.PENDENTE_PAGAMENTO);
    });
  });
});
