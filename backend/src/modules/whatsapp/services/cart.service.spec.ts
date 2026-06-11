import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CartService } from './cart.service';
import { DbContextService } from '../../common/services/db-context.service';

describe('CartService', () => {
  let service: CartService;
  let mockDbContextService: any;
  let mockConfigService: any;

  const mockCartRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    mockDbContextService = {
      getRepository: jest.fn().mockReturnValue(mockCartRepository),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'WHATSAPP_CART_TTL_MINUTES') return '30';
        if (key === 'WHATSAPP_DEFAULT_SHIPPING_AMOUNT') return '10';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: DbContextService, useValue: mockDbContextService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateCart', () => {
    it('should create a new cart when none exists', async () => {
      mockCartRepository.findOne.mockResolvedValue(null);
      mockCartRepository.save.mockImplementation((cart) => Promise.resolve({ ...cart, id: 'cart_123' }));

      const cart = await service.getOrCreateCart('tenant-1', '5511999999999');

      expect(cart).toBeDefined();
      expect(cart.tenant_id).toBe('tenant-1');
      expect(cart.customer_phone).toBe('5511999999999');
      expect(cart.items).toEqual([]);
      expect(cart.status).toBe('active');
      expect(mockCartRepository.save).toHaveBeenCalled();
    });

    it('should return existing active cart', async () => {
      const existingCart = {
        id: 'cart_123',
        tenant_id: 'tenant-1',
        customer_phone: '5511999999999',
        items: [{ produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 }],
        status: 'active',
        subtotal: 10,
        total_amount: 10,
      };

      mockCartRepository.findOne.mockResolvedValue(existingCart);

      const cart = await service.getOrCreateCart('tenant-1', '5511999999999');

      expect(cart).toEqual(existingCart);
      expect(mockCartRepository.save).not.toHaveBeenCalled();
    });

    it('should create new cart when expired cart exists', async () => {
      mockCartRepository.findOne.mockResolvedValue(null);
      mockCartRepository.update.mockResolvedValue({ affected: 1 });
      mockCartRepository.save.mockImplementation((cart) => Promise.resolve({ ...cart, id: 'cart_456' }));

      const cart = await service.getOrCreateCart('tenant-1', '5511999999999');

      expect(cart).toBeDefined();
      expect(mockCartRepository.update).toHaveBeenCalled(); // expire old carts
    });
  });

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      const existingCart = {
        id: 'cart_123',
        tenant_id: 'tenant-1',
        customer_phone: '5511999999999',
        items: [],
        subtotal: 0,
        shipping_amount: 10,
        total_amount: 10,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      };

      mockCartRepository.findOne.mockResolvedValue(existingCart);
      mockCartRepository.save.mockImplementation((cart) => Promise.resolve(cart));

      const result = await service.addItem({
        tenantId: 'tenant-1',
        customerPhone: '5511999999999',
        produtoId: 'prod-1',
        produtoName: 'Brigadeiro',
        quantity: 2,
        unitPrice: 5,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].produto_name).toBe('Brigadeiro');
      expect(result.items[0].quantity).toBe(2);
      expect(result.subtotal).toBe(10);
      expect(result.total_amount).toBe(20); // 10 + 10 (frete)
    });

    it('should update quantity when item already exists', async () => {
      const existingCart = {
        id: 'cart_123',
        tenant_id: 'tenant-1',
        customer_phone: '5511999999999',
        items: [{ produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 }],
        subtotal: 10,
        shipping_amount: 10,
        total_amount: 20,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      };

      mockCartRepository.findOne.mockResolvedValue(existingCart);
      mockCartRepository.save.mockImplementation((cart) => Promise.resolve(cart));

      const result = await service.addItem({
        tenantId: 'tenant-1',
        customerPhone: '5511999999999',
        produtoId: 'prod-1',
        produtoName: 'Brigadeiro',
        quantity: 3,
        unitPrice: 5,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(5); // 2 + 3
      expect(result.subtotal).toBe(25);
    });

    it('should throw error when cart is full', async () => {
      const fullCart = {
        id: 'cart_123',
        tenant_id: 'tenant-1',
        customer_phone: '5511999999999',
        items: Array(50).fill({ produto_id: 'prod', produto_name: 'Test', quantity: 1, unit_price: 5 }),
        status: 'active',
      };

      mockCartRepository.findOne.mockResolvedValue(fullCart);

      await expect(
        service.addItem({
          tenantId: 'tenant-1',
          customerPhone: '5511999999999',
          produtoId: 'new-prod',
          produtoName: 'New Product',
          quantity: 1,
          unitPrice: 5,
        }),
      ).rejects.toThrow('Carrinho cheio');
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const cartWithItem = {
        id: 'cart_123',
        tenant_id: 'tenant-1',
        customer_phone: '5511999999999',
        items: [
          { produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 },
          { produto_id: 'prod-2', produto_name: 'Beijinho', quantity: 1, unit_price: 5 },
        ],
        subtotal: 15,
        shipping_amount: 10,
        total_amount: 25,
        status: 'active',
      };

      mockCartRepository.findOne.mockResolvedValue(cartWithItem);
      mockCartRepository.save.mockImplementation((cart) => Promise.resolve(cart));

      const result = await service.removeItem('cart_123', 'prod-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].produto_id).toBe('prod-2');
    });

    it('should mark cart as abandoned when last item removed', async () => {
      const cartWithOneItem = {
        id: 'cart_123',
        tenant_id: 'tenant-1',
        customer_phone: '5511999999999',
        items: [{ produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 1, unit_price: 5 }],
        status: 'active',
      };

      mockCartRepository.findOne.mockResolvedValue(cartWithOneItem);
      mockCartRepository.save.mockImplementation((cart) => Promise.resolve(cart));

      const result = await service.removeItem('cart_123', 'prod-1');

      expect(result.status).toBe('abandoned');
      expect(result.items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      const cartWithItems = {
        id: 'cart_123',
        tenant_id: 'tenant-1',
        customer_phone: '5511999999999',
        items: [
          { produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 },
          { produto_id: 'prod-2', produto_name: 'Beijinho', quantity: 1, unit_price: 5 },
        ],
        subtotal: 15,
        total_amount: 25,
        status: 'active',
      };

      mockCartRepository.findOne.mockResolvedValue(cartWithItems);
      mockCartRepository.save.mockImplementation((cart) => Promise.resolve(cart));

      const result = await service.clearCart('cart_123');

      expect(result.status).toBe('abandoned');
      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe(0);
      expect(result.total_amount).toBe(0);
    });
  });

  describe('generateSummary', () => {
    it('should generate empty cart message', () => {
      const emptyCart = {
        items: [],
        subtotal: 0,
        shipping_amount: 10,
        total_amount: 10,
        coupon_code: null,
        discount_amount: 0,
      } as any;

      const summary = service.generateSummary(emptyCart);

      expect(summary).toContain('🛒 Carrinho vazio');
    });

    it('should generate cart summary with items', () => {
      const cartWithItems = {
        items: [
          { produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 },
          { produto_id: 'prod-2', produto_name: 'Beijinho', quantity: 1, unit_price: 5 },
        ],
        subtotal: 15,
        shipping_amount: 10,
        total_amount: 25,
        coupon_code: null,
        discount_amount: 0,
      } as any;

      const summary = service.generateSummary(cartWithItems);

      expect(summary).toContain('1. Brigadeiro');
      expect(summary).toContain('2. Beijinho');
      expect(summary).toContain('Subtotal: R$ 15.00');
      expect(summary).toContain('TOTAL: R$ 25.00');
      expect(summary).toContain('remover');
      expect(summary).toContain('confirmar');
    });

    it('should show coupon discount when applied', () => {
      const cartWithCoupon = {
        items: [{ produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 }],
        subtotal: 10,
        shipping_amount: 10,
        total_amount: 15,
        coupon_code: 'DESCONTO10',
        discount_amount: 5,
      } as any;

      const summary = service.generateSummary(cartWithCoupon);

      expect(summary).toContain('DESCONTO10');
      expect(summary).toContain('-R$ 5.00');
    });
  });

  describe('markAsConverted', () => {
    it('should mark cart as converted', async () => {
      const cart = {
        id: 'cart_123',
        status: 'active',
      };

      mockCartRepository.findOne.mockResolvedValue(cart);
      mockCartRepository.save.mockImplementation((c) => Promise.resolve(c));

      await service.markAsConverted('cart_123');

      expect(mockCartRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'converted' }),
      );
    });
  });
});