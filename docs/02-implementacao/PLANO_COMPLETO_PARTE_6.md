# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - PARTE 6/8

## 📊 RELATÓRIOS & ANALYTICS AVANÇADOS

**Objetivo desta Parte:** Implementar sistema completo de relatórios customizados, analytics detalhados e exportação de dados em múltiplos formatos.

**Tempo Estimado:** 2 semanas  
**Prioridade:** 🟡 MÉDIA-ALTA (importante para gestão avançada)

---

## 1. 📈 TIPOS DE RELATÓRIOS

### 1.1 Relatórios Disponíveis

1. **Relatório de Vendas**
   - Por período (dia, semana, mês, ano)
   - Por canal (PDV, E-commerce, WhatsApp)
   - Por produto
   - Por vendedor
   - Comparativo (período vs período)

2. **Relatório de Produtos**
   - Mais vendidos
   - Menos vendidos
   - Rotatividade de estoque
   - Lucratividade (margem)

3. **Relatório de Clientes**
   - Segmentação
   - Clientes mais valiosos
   - Clientes inativos
   - Lifetime Value (LTV)

4. **Relatório Financeiro**
   - Receita bruta
   - Por forma de pagamento
   - Descontos dados
   - Projeção de receita

---

## 2. 🔧 SERVIÇO DE RELATÓRIOS

### 2.1 Reports Service

**Arquivo:** `backend/src/modules/reports/reports.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { Pedido } from '../../database/entities/Pedido.entity';
import { Produto } from '../../database/entities/Produto.entity';
import { ItensPedido } from '../../database/entities/ItensPedido.entity';

export interface SalesReportParams {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  channel?: 'pdv' | 'ecommerce' | 'whatsapp';
  groupBy?: 'day' | 'week' | 'month';
}

export interface SalesReportResult {
  period: string;
  total: number;
  count: number;
  averageTicket: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Pedido)
    private pedidoRepository: Repository<Pedido>,
    @InjectRepository(ItensPedido)
    private itensPedidoRepository: Repository<ItensPedido>,
    private dataSource: DataSource,
  ) {}

  /**
   * Relatório de vendas por período
   */
  async getSalesReport(
    params: SalesReportParams,
  ): Promise<SalesReportResult[]> {
    const query = this.pedidoRepository
      .createQueryBuilder('pedido')
      .where('pedido.tenant_id = :tenantId', { tenantId: params.tenantId })
      .andWhere('pedido.created_at BETWEEN :start AND :end', {
        start: params.startDate,
        end: params.endDate,
      })
      .andWhere('pedido.status != :status', { status: 'cancelado' });

    if (params.channel) {
      query.andWhere('pedido.channel = :channel', { channel: params.channel });
    }

    // Agrupa por período
    if (params.groupBy === 'day') {
      query
        .select("DATE_TRUNC('day', pedido.created_at)", 'period')
        .addSelect('SUM(pedido.total_amount)', 'total')
        .addSelect('COUNT(pedido.id)', 'count')
        .groupBy("DATE_TRUNC('day', pedido.created_at)")
        .orderBy('period', 'ASC');
    } else if (params.groupBy === 'week') {
      query
        .select("DATE_TRUNC('week', pedido.created_at)", 'period')
        .addSelect('SUM(pedido.total_amount)', 'total')
        .addSelect('COUNT(pedido.id)', 'count')
        .groupBy("DATE_TRUNC('week', pedido.created_at)")
        .orderBy('period', 'ASC');
    } else {
      query
        .select("DATE_TRUNC('month', pedido.created_at)", 'period')
        .addSelect('SUM(pedido.total_amount)', 'total')
        .addSelect('COUNT(pedido.id)', 'count')
        .groupBy("DATE_TRUNC('month', pedido.created_at)")
        .orderBy('period', 'ASC');
    }

    const results = await query.getRawMany();

    return results.map((row) => ({
      period: row.period.toISOString().split('T')[0],
      total: parseFloat(row.total || 0),
      count: parseInt(row.count || 0),
      averageTicket: parseFloat(row.total || 0) / (parseInt(row.count || 1)),
    }));
  }

  /**
   * Top produtos mais vendidos
   */
  async getTopProducts(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10,
  ) {
    const results = await this.itensPedidoRepository
      .createQueryBuilder('item')
      .innerJoin('item.pedido', 'pedido')
      .innerJoin('item.produto', 'produto')
      .where('pedido.tenant_id = :tenantId', { tenantId })
      .andWhere('pedido.created_at BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere('pedido.status != :status', { status: 'cancelado' })
      .select('produto.name', 'name')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .addSelect('SUM(item.subtotal)', 'totalRevenue')
      .addSelect('COUNT(DISTINCT pedido.id)', 'ordersCount')
      .groupBy('produto.id, produto.name')
      .orderBy('totalQuantity', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((row) => ({
      name: row.name,
      quantity: parseInt(row.totalQuantity || 0),
      revenue: parseFloat(row.totalRevenue || 0),
      ordersCount: parseInt(row.ordersCount || 0),
    }));
  }

  /**
   * Relatório financeiro completo
   */
  async getFinancialReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const pedidos = await this.pedidoRepository.find({
      where: {
        tenant_id: tenantId,
        created_at: Between(startDate, endDate),
        status: { $ne: 'cancelado' },
      },
    });

    const total = pedidos.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
    const discounts = pedidos.reduce((sum, p) => sum + (p.discount_amount || 0), 0);
    const byPaymentMethod = this.groupByPaymentMethod(pedidos);
    const byChannel = this.groupByChannel(pedidos);

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalRevenue: total,
        totalDiscounts: discounts,
        netRevenue: total - discounts,
        ordersCount: pedidos.length,
        averageTicket: total / (pedidos.length || 1),
      },
      byPaymentMethod,
      byChannel,
    };
  }

  private groupByPaymentMethod(pedidos: Pedido[]) {
    const groups: Record<string, { count: number; total: number }> = {};

    pedidos.forEach((p) => {
      const method = p.payment_method || 'unknown';
      if (!groups[method]) {
        groups[method] = { count: 0, total: 0 };
      }
      groups[method].count++;
      groups[method].total += parseFloat(p.total_amount);
    });

    return groups;
  }

  private groupByChannel(pedidos: Pedido[]) {
    const groups: Record<string, { count: number; total: number }> = {};

    pedidos.forEach((p) => {
      const channel = p.channel || 'unknown';
      if (!groups[channel]) {
        groups[channel] = { count: 0, total: 0 };
      }
      groups[channel].count++;
      groups[channel].total += parseFloat(p.total_amount);
    });

    return groups;
  }
}
```

---

## 3. 📤 EXPORTAÇÃO DE DADOS

### 3.1 Exportação Excel

**Arquivo:** `backend/src/modules/reports/services/excel-export.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelExportService {
  async exportSalesReport(data: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Vendas');

    // Headers
    worksheet.columns = [
      { header: 'Data', key: 'period', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Quantidade', key: 'count', width: 15 },
      { header: 'Ticket Médio', key: 'averageTicket', width: 15 },
    ];

    // Data
    data.forEach((row) => {
      worksheet.addRow({
        period: row.period,
        total: row.total,
        count: row.count,
        averageTicket: row.averageTicket,
      });
    });

    // Format currency
    worksheet.getColumn('total').numFmt = 'R$ #,##0.00';
    worksheet.getColumn('averageTicket').numFmt = 'R$ #,##0.00';

    // Generate buffer
    return await workbook.xlsx.writeBuffer();
  }
}
```

---

## 4. ✅ CHECKLIST DE IMPLEMENTAÇÃO - PARTE 6

### 4.1 Backend
- [ ] Criar `ReportsService`
- [ ] Criar `ReportsController`
- [ ] Implementar relatório de vendas
- [ ] Implementar relatório de produtos
- [ ] Implementar relatório financeiro
- [ ] Implementar relatório de clientes

### 4.2 Exportação
- [ ] Implementar exportação Excel
- [ ] Implementar exportação PDF
- [ ] Implementar exportação CSV

### 4.3 Frontend
- [ ] Criar página de relatórios
- [ ] Criar filtros de período
- [ ] Criar gráficos interativos
- [ ] Implementar botões de exportação

---

## 5. 📝 PRÓXIMOS PASSOS (Após Parte 6)

**PARTE 7:** Funcionalidades Extras
- Gestão de produção
- Marketing e promoções
- Integrações

---

**Status:** ✅ PARTE 6 COMPLETA  
**Próxima Parte:** PARTE 7 - Funcionalidades Extras
