import { Injectable, BadRequestException, NotFoundException, ConflictException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { Pedido, PedidoStatus, CanalVenda } from '../../database/entities/Pedido.entity';
import { ItemPedido } from '../../database/entities/ItemPedido.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { Produto } from '../../database/entities/Produto.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { IdempotencyService } from '../common/services/idempotency.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IdempotencyRecord, toIdempotencyRecord } from './types/orders.types';
import { PaginatedResult, createPaginatedResult } from '../common/types/pagination.types';
import { PaginationDto } from './dto/pagination.dto';
import { CouponsService } from '../coupons/coupons.service';
import { CupomDesconto } from '../../database/entities/CupomDesconto.entity';
import { DbContextService } from '../common/services/db-context.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Pedido)
    private pedidosRepository: Repository<Pedido>,
    @InjectRepository(ItemPedido)
    private itensRepository: Repository<ItemPedido>,
    @InjectRepository(Produto)
    private produtosRepository: Repository<Produto>,
    @InjectDataSource()
    private dataSource: DataSource,
    private readonly db: DbContextService,
    private idempotencyService: IdempotencyService,
    private auditLogService: AuditLogService,
    private couponsService: CouponsService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
    tenantId: string,
    userId?: string,
    idempotencyKey?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Pedido> {
    let idempotencyRecord: IdempotencyRecord | null = null;

      // ✅ IDEMPOTÊNCIA: Verificar se operação já foi processada
      if (idempotencyKey) {
        const idempotencyKeyEntity = await this.idempotencyService.checkAndSet(
          tenantId,
          'create_order',
          idempotencyKey,
          3600, // 1 hora
        );

        if (idempotencyKeyEntity) {
          idempotencyRecord = toIdempotencyRecord(idempotencyKeyEntity);
          
          if (idempotencyRecord.status === 'completed') {
            // Operação já foi processada, retornar resultado anterior
            if (idempotencyRecord.result) {
              return idempotencyRecord.result as Pedido;
            }
            throw new ConflictException(
              `Pedido já foi criado com esta chave de idempotência. Key: ${idempotencyKey}`,
            );
          }
        }
      }

    const deliveryTypeRaw = (createOrderDto.delivery_type || '').trim();
    const deliveryType = deliveryTypeRaw ? deliveryTypeRaw.toLowerCase() : undefined;
    const deliveryAddress = createOrderDto.delivery_address;

    if (deliveryType && deliveryType !== 'delivery' && deliveryType !== 'pickup') {
      throw new BadRequestException(`delivery_type inválido: ${deliveryTypeRaw}`);
    }
    if (deliveryType === 'delivery' && !deliveryAddress) {
      throw new BadRequestException('delivery_address é obrigatório quando delivery_type=delivery');
    }

    // Cálculo de subtotal
    const subtotal = createOrderDto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );

    const shipping = createOrderDto.shipping_amount || 0;

    // Cupom: recalcular desconto no momento da criação (regra única e proteção contra corrida)
    let couponCode = (createOrderDto.coupon_code || '').trim().toUpperCase() || null;
    let discount = createOrderDto.discount_amount || 0;
    if (couponCode) {
      const coupon = await this.couponsService.findActiveByCode(tenantId, couponCode);
      if (!coupon) {
        throw new BadRequestException(`Cupom inválido/inativo: ${couponCode}`);
      }
      const validation = this.couponsService.validateCoupon(subtotal, coupon);
      if (!validation.valid) {
        throw new BadRequestException(`Cupom inválido: ${validation.reason}`);
      }
      discount = validation.discountAmount;
      couponCode = validation.code;
    }

    const total = subtotal - discount + shipping;

    // Inicia transação CRÍTICA
    const pedido = await this.db.runInTransaction(async (manager) => {
      // 1. FOR UPDATE lock - Bloqueia linhas de estoque
      const produtoIds = createOrderDto.items.map((item) => item.produto_id);
      const estoques = await manager
        .createQueryBuilder(MovimentacaoEstoque, 'e')
        .where('e.tenant_id = :tenantId', { tenantId })
        .andWhere('e.produto_id IN (:...produtoIds)', { produtoIds })
        .setLock('pessimistic_write') // FOR UPDATE lock
        .getMany();

      // 2. Verificar se todos os produtos existem e estão ativos
      const produtoIdsParaValidar = createOrderDto.items.map((item) => item.produto_id);
      const produtos = await manager
        .createQueryBuilder(Produto, 'p')
        .where('p.id IN (:...produtoIds)', { produtoIds: produtoIdsParaValidar })
        .andWhere('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.is_active = :isActive', { isActive: true })
        .getMany();
      
      if (produtos.length !== produtoIdsParaValidar.length) {
        const produtosEncontrados = produtos.map((p) => p.id);
        const produtosNaoEncontrados = produtoIdsParaValidar.filter((id) => !produtosEncontrados.includes(id));
        throw new NotFoundException(
          `Produtos não encontrados ou inativos: ${produtosNaoEncontrados.join(', ')}`,
        );
      }

      // 3. Verificar se todos os produtos têm estoque cadastrado
      const produtosMap = new Map(estoques.map((e) => [e.produto_id, e]));
      for (const item of createOrderDto.items) {
        if (!produtosMap.has(item.produto_id)) {
          throw new NotFoundException(`Produto ${item.produto_id} sem estoque cadastrado`);
        }
      }

      // 4. Validar estoque disponível (considerando reservas)
      for (const item of createOrderDto.items) {
        const estoque = produtosMap.get(item.produto_id)!;
        const availableStock = estoque.current_stock - estoque.reserved_stock;
        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para produto ${item.produto_id}: necessário ${item.quantity}, disponível ${availableStock}`,
          );
        }
      }

      // 5. Abater estoque e liberar reserva (dentro da transação)
      for (const item of createOrderDto.items) {
        await manager
          .createQueryBuilder()
          .update(MovimentacaoEstoque)
          .set({
            current_stock: () => `current_stock - ${item.quantity}`,
            reserved_stock: () => `GREATEST(0, reserved_stock - ${item.quantity})`, // Libera a reserva
            last_updated: () => 'NOW()',
          })
          .where('tenant_id = :tenantId', { tenantId })
          .andWhere('produto_id = :produtoId', { produtoId: item.produto_id })
          .execute();
      }

      // 6. Criar pedido
      const orderNo = await this.generateOrderNumber(tenantId);
      // PDV = ENTREGUE (pagamento no ato)
      // WHATSAPP = PENDENTE_PAGAMENTO (aguarda confirmação)
      // ECOMMERCE = CONFIRMADO (pagamento online já processado)
      let initialStatus: PedidoStatus;
      if (createOrderDto.channel === CanalVenda.PDV) {
        initialStatus = PedidoStatus.ENTREGUE;
      } else if (createOrderDto.channel === CanalVenda.WHATSAPP) {
        initialStatus = PedidoStatus.PENDENTE_PAGAMENTO;
      } else {
        initialStatus = PedidoStatus.CONFIRMADO;
      }

      const pedido = manager.getRepository(Pedido).create();
      pedido.tenant_id = tenantId;
      pedido.order_no = orderNo;
      pedido.status = initialStatus;
      pedido.channel = createOrderDto.channel;
      pedido.customer_name = createOrderDto.customer_name;
      pedido.customer_email = createOrderDto.customer_email;
      pedido.customer_phone = createOrderDto.customer_phone;
      pedido.subtotal = subtotal;
      pedido.discount_amount = discount;
      pedido.shipping_amount = shipping;
      pedido.coupon_code = couponCode || undefined;
      pedido.total_amount = total;
      pedido.delivery_type = deliveryType;
      pedido.delivery_address = deliveryType === 'delivery' ? (deliveryAddress as any) : null;

      const savedPedido = await manager.save(pedido);

      // 7. Criar itens do pedido
      const itens = createOrderDto.items.map((item) =>
        manager.create(ItemPedido, {
          pedido_id: savedPedido.id,
          produto_id: item.produto_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.unit_price * item.quantity,
        }),
      );

      await manager.save(itens);

      // Consumir cupom (incrementa used_count com proteção contra corrida)
      if (couponCode) {
        const res = await manager
          .createQueryBuilder()
          .update(CupomDesconto)
          .set({ used_count: () => '"used_count" + 1' })
          .where('tenant_id = :tenantId', { tenantId })
          .andWhere('code = :code', { code: couponCode })
          .andWhere('is_active = true')
          .andWhere('(usage_limit IS NULL OR used_count < usage_limit)')
          .execute();

        if (!res.affected || res.affected < 1) {
          throw new BadRequestException(`Cupom esgotado/inválido: ${couponCode}`);
        }
      }

      // 7. COMMIT (ou ROLLBACK se houver erro)
      return savedPedido;
    });

    // ✅ AUDIT LOG: Registrar criação de pedido
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'CREATE',
        tableName: 'pedidos',
        recordId: pedido.id,
        newData: {
          order_no: pedido.order_no,
          status: pedido.status,
          channel: pedido.channel,
          total_amount: pedido.total_amount,
          items_count: createOrderDto.items.length,
        },
        ipAddress,
        userAgent,
      });
    } catch (error) {
      // Não falhar se audit log falhar (logging não deve quebrar operação)
      this.logger.error('Erro ao registrar audit log', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, userId, pedidoId: pedido.id, action: 'CREATE' },
      });
    }

    // ✅ IDEMPOTÊNCIA: Marcar como completado
    if (idempotencyKey && idempotencyRecord) {
      try {
        await this.idempotencyService.markCompleted(idempotencyRecord.id, pedido);
      } catch (error) {
        // Não falhar se idempotência falhar, mas logar adequadamente
        this.logger.error('Erro ao marcar idempotência como completada', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          idempotencyRecordId: idempotencyRecord.id,
          pedidoId: pedido.id,
        });
      }
    }

    // ✅ NOVO: Notificar cliente sobre criação do pedido (especialmente para WhatsApp)
    if (createOrderDto.channel === CanalVenda.WHATSAPP) {
      try {
        // Notificar mudança de status (de null para PENDENTE_PAGAMENTO)
        await this.notificationsService.notifyOrderStatusChange(
          tenantId,
          pedido,
          null, // Status anterior não existe (pedido novo)
          pedido.status,
        );
      } catch (error) {
        // Não falhar a criação se a notificação falhar
        this.logger.error('Error sending order creation notification', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            tenantId,
            pedidoId: pedido.id,
            channel: createOrderDto.channel,
          },
        });
      }
    }

    return pedido;
  }

  async findAll(tenantId: string, pagination?: PaginationDto): Promise<Pedido[] | PaginatedResult<Pedido>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = (page - 1) * limit;
    const pedidosRepository = this.db.getRepository(Pedido);

    // ✅ PERFORMANCE: Remover relations do findAll para evitar N+1 e queries pesadas
    // Relations serão carregadas apenas no findOne quando necessário
    // Se paginação foi solicitada, retornar resultado paginado
    if (pagination) {
      const [data, total] = await pedidosRepository.findAndCount({
        where: { tenant_id: tenantId },
        // Removido relations para performance - carregar apenas no findOne
        order: { created_at: 'DESC' },
        skip,
        take: limit,
      });

      return createPaginatedResult(data, total, page, limit);
    }

    // Sem paginação: comportamento original (retorna todos, sem relations)
    return pedidosRepository.find({
      where: { tenant_id: tenantId },
      // Removido relations para performance - carregar apenas no findOne
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Pedido> {
    const pedido = await this.db.getRepository(Pedido).findOne({
      where: { id, tenant_id: tenantId },
      relations: ['itens', 'itens.produto', 'seller'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }

    return pedido;
  }

  async findByOrderNo(orderNo: string, tenantId: string): Promise<Pedido | null> {
    const normalized = (orderNo || '').trim();
    if (!normalized) return null;

    return await this.db.getRepository(Pedido).findOne({
      where: { order_no: normalized, tenant_id: tenantId },
      relations: ['itens', 'itens.produto', 'seller'],
    });
  }

  async updateStatus(
    id: string,
    status: PedidoStatus,
    tenantId: string,
  ): Promise<Pedido> {
    const pedido = await this.findOne(id, tenantId);
    const oldStatus = pedido.status;
    pedido.status = status;
    const updatedPedido = await this.db.getRepository(Pedido).save(pedido);

    // Notificar cliente sobre mudança de status
    if (oldStatus !== status) {
      try {
        await this.notificationsService.notifyOrderStatusChange(
          tenantId,
          updatedPedido,
          oldStatus,
          status,
        );
      } catch (error) {
        // Não falhar a atualização se a notificação falhar
        this.logger.error('Error sending order status notification', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            tenantId,
            pedidoId: id,
            oldStatus,
            newStatus: status,
          },
        });
      }
    }

    return updatedPedido;
  }

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PED-${dateStr}-`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = randomBytes(2).toString('hex').toUpperCase();
      const orderNo = `${prefix}${suffix}`;
      const exists = await this.db.getRepository(Pedido).count({
        where: { order_no: orderNo, tenant_id: tenantId },
      });
      if (!exists) {
        return orderNo;
      }
    }

    const fallback = randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${fallback}`;
  }

  async getSalesReport(tenantId: string): Promise<any> {
    const orders = await this.db.getRepository(Pedido).find({
      where: { tenant_id: tenantId },
      relations: ['itens', 'itens.produto', 'seller'],
      order: { created_at: 'DESC' },
    });
    
    const totalSales = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Sales by channel
    const salesByChannel = orders.reduce((acc, order) => {
      const channel = order.channel || 'unknown';
      acc[channel] = (acc[channel] || 0) + Number(order.total_amount);
      return acc;
    }, {} as Record<string, number>);

    // Orders by status
    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top produtos mais vendidos
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    
    for (const order of orders) {
      if (order.itens && Array.isArray(order.itens)) {
        for (const item of order.itens) {
          const produtoId = item.produto_id;
          const produto = item.produto;
          const produtoName = produto?.name || `Produto ${produtoId}`;
          
          if (!productSales.has(produtoId)) {
            productSales.set(produtoId, { name: produtoName, quantity: 0, revenue: 0 });
          }
          
          const productData = productSales.get(produtoId)!;
          productData.quantity += item.quantity;
          productData.revenue += Number(item.subtotal || item.unit_price * item.quantity);
        }
      }
    }

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((p, index) => ({ ...p, rank: index + 1 }));

    // Vendas por período (hoje, semana, mês)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const salesToday = orders
      .filter((o) => new Date(o.created_at) >= today)
      .reduce((sum, o) => sum + Number(o.total_amount), 0);
    
    const salesThisWeek = orders
      .filter((o) => new Date(o.created_at) >= weekAgo)
      .reduce((sum, o) => sum + Number(o.total_amount), 0);
    
    const salesThisMonth = orders
      .filter((o) => new Date(o.created_at) >= monthAgo)
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    // Vendas por dia (últimos 7 dias) para gráfico
    const salesByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      salesByDay[dateStr] = 0;
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const dateStr = orderDate.toISOString().split('T')[0];
      if (salesByDay[dateStr] !== undefined) {
        salesByDay[dateStr] += Number(order.total_amount);
      }
    });

    return {
      totalSales,
      totalOrders,
      avgTicket,
      salesByChannel,
      ordersByStatus,
      topProducts,
      salesByPeriod: {
        today: salesToday,
        thisWeek: salesThisWeek,
        thisMonth: salesThisMonth,
      },
      salesByDay: Object.entries(salesByDay).map(([date, value]) => ({
        date,
        value,
      })),
      recentOrders: orders.slice(0, 10),
    };
  }
}
