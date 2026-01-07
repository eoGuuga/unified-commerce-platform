import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { ItemPedido } from '../../database/entities/ItemPedido.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { Produto } from '../../database/entities/Produto.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CanalVenda } from '../../database/entities/Pedido.entity';

describe('OrdersService', () => {
  let service: OrdersService;
  let pedidosRepository: Repository<Pedido>;
  let itensRepository: Repository<ItemPedido>;
  let produtosRepository: Repository<Produto>;
  let dataSource: DataSource;
  let manager: EntityManager;

  const mockPedidoRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const mockItensRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockProdutosRepository = {
    find: jest.fn(),
  };

  const mockManager = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
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
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    pedidosRepository = module.get<Repository<Pedido>>(getRepositoryToken(Pedido));
    itensRepository = module.get<Repository<ItemPedido>>(getRepositoryToken(ItemPedido));
    produtosRepository = module.get<Repository<Produto>>(getRepositoryToken(Produto));
    dataSource = module.get<DataSource>(getDataSourceToken());

    manager = mockManager as unknown as EntityManager;
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

    const mockPedido: Partial<Pedido> = {
      id: 'pedido-id',
      tenant_id: tenantId,
      order_no: 'PED-20260107-001',
      status: PedidoStatus.ENTREGUE,
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
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEstoques),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn(() => queryBuilder as any);
      mockManager.create = jest.fn().mockReturnValue(mockPedido);
      mockManager.save = jest.fn().mockResolvedValue(mockPedido);

      mockDataSource.transaction = jest.fn(async (callback) => {
        return callback(manager);
      });

      jest.spyOn(service as any, 'generateOrderNumber').mockResolvedValue('PED-20260107-001');

      // Act
      const result = await service.create(createOrderDto, tenantId);

      // Assert
      expect(result).toBeDefined();
      expect(result.total_amount).toBe(112.5); // (5 * 10.5) + (3 * 20.0) = 52.5 + 60 = 112.5
      expect(result.status).toBe(PedidoStatus.ENTREGUE); // PDV = ENTREGUE
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(queryBuilder.getMany).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando produto não tem estoque cadastrado', async () => {
      // Arrange
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEstoques[0]]), // Apenas um produto
      };

      mockManager.createQueryBuilder = jest.fn(() => queryBuilder as any);

      mockDataSource.transaction = jest.fn(async (callback) => {
        try {
          return await callback(manager);
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

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(estoquesInsuficientes),
      };

      mockManager.createQueryBuilder = jest.fn(() => queryBuilder as any);

      mockDataSource.transaction = jest.fn(async (callback) => {
        return callback(manager);
      });

      // Act & Assert
      await expect(service.create(createOrderDto, tenantId)).rejects.toThrow(BadRequestException);
      await expect(service.create(createOrderDto, tenantId)).rejects.toThrow('Estoque insuficiente');
    });

    it('deve considerar estoque reservado ao validar disponibilidade', async () => {
      // Arrange
      const estoquesComReserva: Partial<MovimentacaoEstoque>[] = [
        {
          ...mockEstoques[0],
          current_stock: 10,
          reserved_stock: 6, // Estoque disponível = 10 - 6 = 4, mas precisa de 5
        },
        mockEstoques[1],
      ] as MovimentacaoEstoque[];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(estoquesComReserva),
      };

      mockManager.createQueryBuilder = jest.fn(() => queryBuilder as any);

      mockDataSource.transaction = jest.fn(async (callback) => {
        return callback(manager);
      });

      // Act & Assert
      await expect(service.create(createOrderDto, tenantId)).rejects.toThrow(BadRequestException);
      await expect(service.create(createOrderDto, tenantId)).rejects.toThrow('Estoque insuficiente');
    });

    it('deve calcular totais corretamente com desconto e frete', async () => {
      // Arrange
      const orderComDesconto: CreateOrderDto = {
        ...createOrderDto,
        discount_amount: 10.0,
        shipping_amount: 5.0,
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEstoques),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn(() => queryBuilder as any);
      const pedidoComDesconto = {
        ...mockPedido,
        subtotal: 112.5,
        discount_amount: 10.0,
        shipping_amount: 5.0,
        total_amount: 107.5, // 112.5 - 10 + 5
      };
      mockManager.create = jest.fn().mockReturnValue(pedidoComDesconto);
      mockManager.save = jest.fn().mockResolvedValue(pedidoComDesconto);

      mockDataSource.transaction = jest.fn(async (callback) => {
        return callback(manager);
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

    it('deve definir status correto baseado no canal (PDV = ENTREGUE, outros = CONFIRMADO)', async () => {
      // Arrange
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockEstoques),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockManager.createQueryBuilder = jest.fn(() => queryBuilder as any);
      mockManager.create = jest.fn().mockReturnValue(mockPedido);
      mockManager.save = jest.fn().mockResolvedValue(mockPedido);

      mockDataSource.transaction = jest.fn(async (callback) => {
        return callback(manager);
      });

      jest.spyOn(service as any, 'generateOrderNumber').mockResolvedValue('PED-20260107-001');

      // Test PDV
      const resultPDV = await service.create(createOrderDto, tenantId);
      expect(resultPDV.status).toBe(PedidoStatus.ENTREGUE);

      // Test E-commerce
      const orderEcommerce = { ...createOrderDto, channel: CanalVenda.ECOMMERCE };
      const pedidoEcommerce = { ...mockPedido, status: PedidoStatus.CONFIRMADO };
      mockManager.create = jest.fn().mockReturnValue(pedidoEcommerce);
      mockManager.save = jest.fn().mockResolvedValue(pedidoEcommerce);

      const resultEcommerce = await service.create(orderEcommerce, tenantId);
      expect(resultEcommerce.status).toBe(PedidoStatus.CONFIRMADO);
    });
  });
});
