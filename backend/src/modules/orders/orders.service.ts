import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { ItemPedido } from '../../database/entities/ItemPedido.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { Produto } from '../../database/entities/Produto.entity';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Pedido)
    private pedidosRepository: Repository<Pedido>,
    @InjectRepository(ItemPedido)
    private itensRepository: Repository<ItemPedido>,
    @InjectRepository(Produto)
    private produtosRepository: Repository<Produto>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async create(createOrderDto: CreateOrderDto, tenantId: string): Promise<Pedido> {
    // Cálculo de subtotal
    const subtotal = createOrderDto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    const discount = createOrderDto.discount_amount || 0;
    const shipping = createOrderDto.shipping_amount || 0;
    const total = subtotal - discount + shipping;

    // Inicia transação CRÍTICA
    return await this.dataSource.transaction(async (manager) => {
      // 1. FOR UPDATE lock - Bloqueia linhas de estoque
      const produtoIds = createOrderDto.items.map((item) => item.produto_id);
      const estoques = await manager
        .createQueryBuilder(MovimentacaoEstoque, 'e')
        .where('e.tenant_id = :tenantId', { tenantId })
        .andWhere('e.produto_id IN (:...produtoIds)', { produtoIds })
        .setLock('pessimistic_write') // FOR UPDATE lock
        .getMany();

      // 2. Verificar se todos os produtos têm estoque cadastrado
      const produtosMap = new Map(estoques.map((e) => [e.produto_id, e]));
      for (const item of createOrderDto.items) {
        if (!produtosMap.has(item.produto_id)) {
          throw new NotFoundException(`Produto ${item.produto_id} sem estoque cadastrado`);
        }
      }

      // 3. Validar estoque disponível (considerando reservas)
      for (const item of createOrderDto.items) {
        const estoque = produtosMap.get(item.produto_id)!;
        const availableStock = estoque.current_stock - estoque.reserved_stock;
        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente para produto ${item.produto_id}: necessário ${item.quantity}, disponível ${availableStock}`,
          );
        }
      }

      // 4. Abater estoque e liberar reserva (dentro da transação)
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

      // 5. Criar pedido
      const orderNo = await this.generateOrderNumber(tenantId);
      const initialStatus: PedidoStatus =
        createOrderDto.channel === 'pdv' ? PedidoStatus.ENTREGUE : PedidoStatus.CONFIRMADO;

      const pedido = manager.create(Pedido, {
        tenant_id: tenantId,
        order_no: orderNo,
        status: initialStatus,
        channel: createOrderDto.channel,
        customer_name: createOrderDto.customer_name,
        customer_email: createOrderDto.customer_email,
        customer_phone: createOrderDto.customer_phone,
        subtotal,
        discount_amount: discount,
        shipping_amount: shipping,
        total_amount: total,
      });

      const savedPedido = await manager.save(pedido);

      // 6. Criar itens do pedido
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

      // 7. COMMIT (ou ROLLBACK se houver erro)
      return savedPedido;
    });
  }

  async findAll(tenantId: string): Promise<Pedido[]> {
    return this.pedidosRepository.find({
      where: { tenant_id: tenantId },
      relations: ['itens', 'itens.produto', 'seller'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Pedido> {
    const pedido = await this.pedidosRepository.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['itens', 'itens.produto', 'seller'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }

    return pedido;
  }

  async updateStatus(
    id: string,
    status: PedidoStatus,
    tenantId: string,
  ): Promise<Pedido> {
    const pedido = await this.findOne(id, tenantId);
    pedido.status = status;
    return this.pedidosRepository.save(pedido);
  }

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const today = dateStr.substring(0, 8); // YYYYMMDD

    // Contar pedidos do dia
    const count = await this.pedidosRepository.count({
      where: {
        tenant_id: tenantId,
      },
    });

    const seq = String(count + 1).padStart(3, '0');
    return `PED-${today}-${seq}`;
  }

  async getSalesReport(tenantId: string): Promise<any> {
    const orders = await this.findAll(tenantId);
    
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
