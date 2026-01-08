# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - PARTE 5/8

## 📊 DASHBOARD COMPLETO PARA DONO DA LOJA

**Objetivo desta Parte:** Criar dashboard completo e profissional com KPIs, gestão de vendas, clientes, estoque e relatórios em tempo real.

**Tempo Estimado:** 3-4 semanas  
**Prioridade:** 🟡 ALTA (essencial para gestão)

---

## 1. 🎨 ESTRUTURA DO DASHBOARD

### 1.1 Páginas Principais

```
/admin
├── /dashboard          # Home com KPIs
├── /vendas            # Gestão de vendas/pedidos
├── /clientes          # Gestão de clientes
├── /estoque           # Gestão de estoque
├── /produtos          # Gestão de produtos
├── /relatorios        # Relatórios e analytics
├── /configuracoes     # Configurações gerais
└── /usuarios          # Gestão de usuários
```

---

## 2. 📈 DASHBOARD PRINCIPAL (Home)

### 2.1 KPIs em Cards

**Arquivo:** `frontend/app/admin/dashboard/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface DashboardKPIs {
  receitaHoje: number;
  receitaOntem: number;
  receitaMes: number;
  receitaMesAnterior: number;
  pedidosHoje: number;
  pedidosPendentes: number;
  ticketMedio: number;
  produtosEmFalta: number;
  novosClientesHoje: number;
  novosClientesMes: number;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKPIs();
    // Atualiza a cada 30 segundos
    const interval = setInterval(loadKPIs, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadKPIs = async () => {
    try {
      const data = await api.getDashboardKPIs();
      setKpis(data);
    } catch (error) {
      console.error('Erro ao carregar KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !kpis) {
    return <div>Carregando...</div>;
  }

  const receitaCrescimento = kpis.receitaOntem > 0
    ? ((kpis.receitaHoje - kpis.receitaOntem) / kpis.receitaOntem) * 100
    : 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Receita Hoje"
          value={formatCurrency(kpis.receitaHoje)}
          subtitle={`vs ontem: ${formatCurrency(kpis.receitaOntem)}`}
          trend={receitaCrescimento}
          icon="💰"
        />

        <KPICard
          title="Receita do Mês"
          value={formatCurrency(kpis.receitaMes)}
          subtitle={`vs mês anterior: ${formatCurrency(kpis.receitaMesAnterior)}`}
          trend={
            kpis.receitaMesAnterior > 0
              ? ((kpis.receitaMes - kpis.receitaMesAnterior) / kpis.receitaMesAnterior) * 100
              : 0
          }
          icon="📊"
        />

        <KPICard
          title="Pedidos Hoje"
          value={kpis.pedidosHoje}
          subtitle={`${kpis.pedidosPendentes} pendentes`}
          icon="📦"
        />

        <KPICard
          title="Ticket Médio"
          value={formatCurrency(kpis.ticketMedio)}
          icon="🎯"
        />

        <KPICard
          title="Produtos em Falta"
          value={kpis.produtosEmFalta}
          subtitle={kpis.produtosEmFalta > 0 ? '⚠️ Precisa atenção' : '✅ Tudo ok'}
          icon="⚠️"
          warning={kpis.produtosEmFalta > 0}
        />

        <KPICard
          title="Novos Clientes"
          value={kpis.novosClientesHoje}
          subtitle={`${kpis.novosClientesMes} este mês`}
          icon="👥"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart />
        <TopProductsChart />
      </div>

      {/* Pedidos Recentes */}
      <RecentOrders />
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  warning = false,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: string;
  warning?: boolean;
}) {
  const trendColor = trend !== undefined
    ? trend >= 0
      ? 'text-green-600'
      : 'text-red-600'
    : '';

  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${
        warning ? 'border-l-4 border-yellow-500' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend !== undefined && (
            <p className={`text-sm font-medium mt-1 ${trendColor}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </p>
          )}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
```

---

## 3. 📦 GESTÃO DE VENDAS

### 3.1 Página de Vendas

**Arquivo:** `frontend/app/admin/vendas/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface Order {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  channel: 'pdv' | 'ecommerce' | 'whatsapp';
  items: Array<{
    produto_name: string;
    quantity: number;
    unit_price: number;
  }>;
}

export default function VendasPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    channel: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  useEffect(() => {
    loadOrders();
  }, [filters]);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders(filters);
      setOrders(data);
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      loadOrders();
    } catch (error) {
      alert('Erro ao atualizar status');
    }
  };

  const totalVendas = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const pedidosCount = orders.length;
  const ticketMedio = pedidosCount > 0 ? totalVendas / pedidosCount : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Vendas e Pedidos</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          Exportar Excel
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Vendido</p>
          <p className="text-2xl font-bold">
            {formatCurrency(totalVendas)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Pedidos</p>
          <p className="text-2xl font-bold">{pedidosCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Ticket Médio</p>
          <p className="text-2xl font-bold">
            {formatCurrency(ticketMedio)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <FiltersBar filters={filters} onChange={setFilters} />

      {/* Tabela */}
      <OrdersTable
        orders={orders}
        onStatusChange={updateOrderStatus}
        loading={loading}
      />
    </div>
  );
}
```

---

## 4. 👥 GESTÃO DE CLIENTES

### 4.1 Página de Clientes

**Arquivo:** `frontend/app/admin/clientes/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  total_spent: number;
  orders_count: number;
  last_order_date?: string;
  average_ticket: number;
  classification: 'new' | 'recurrent' | 'vip';
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await api.getCustomers({ sortBy: 'total_spent' });
      setCustomers(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Clientes</h1>

      {/* Top Clientes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Top Clientes</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Total Gasto</th>
              <th className="text-left p-2">Pedidos</th>
              <th className="text-left p-2">Ticket Médio</th>
              <th className="text-left p-2">Classificação</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b">
                <td className="p-2">{customer.name}</td>
                <td className="p-2">{formatCurrency(customer.total_spent)}</td>
                <td className="p-2">{customer.orders_count}</td>
                <td className="p-2">
                  {formatCurrency(customer.average_ticket)}
                </td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      customer.classification === 'vip'
                        ? 'bg-yellow-100 text-yellow-800'
                        : customer.classification === 'recurrent'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {customer.classification === 'vip'
                      ? '⭐ VIP'
                      : customer.classification === 'recurrent'
                      ? '🔄 Recorrente'
                      : '🆕 Novo'}
                  </span>
                </td>
                <td className="p-2">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => window.open(`https://wa.me/${customer.phone}`)}
                  >
                    WhatsApp
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 5. 📦 GESTÃO DE ESTOQUE

### 5.1 Página de Estoque

**Arquivo:** `frontend/app/admin/estoque/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface InventoryItem {
  produto_id: string;
  produto_name: string;
  current_stock: number;
  min_stock: number;
  reserved_stock: number;
  available_stock: number;
  last_movement?: string;
}

export default function EstoquePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const data = await api.getInventory();
      setInventory(data);
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
    } finally {
      setLoading(false);
    }
  };

  const addStock = async (productId: string, quantity: number) => {
    try {
      await api.addStock(productId, quantity);
      loadInventory();
    } catch (error) {
      alert('Erro ao adicionar estoque');
    }
  };

  const produtosEmFalta = inventory.filter(
    (item) => item.available_stock <= item.min_stock,
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gestão de Estoque</h1>
        {produtosEmFalta.length > 0 && (
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg">
            ⚠️ {produtosEmFalta.length} produto(s) em falta
          </div>
        )}
      </div>

      {/* Alertas */}
      {produtosEmFalta.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-bold text-red-800 mb-2">
            Produtos com Estoque Baixo
          </h2>
          <ul className="space-y-1">
            {produtosEmFalta.map((item) => (
              <li key={item.produto_id} className="text-red-700">
                {item.produto_name}: {item.available_stock} unidades (mínimo:{' '}
                {item.min_stock})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabela de Estoque */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-4">Produto</th>
              <th className="text-left p-4">Estoque Atual</th>
              <th className="text-left p-4">Reservado</th>
              <th className="text-left p-4">Disponível</th>
              <th className="text-left p-4">Mínimo</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <InventoryRow
                key={item.produto_id}
                item={item}
                onAddStock={addStock}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryRow({
  item,
  onAddStock,
}: {
  item: InventoryItem;
  onAddStock: (productId: string, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const statusColor =
    item.available_stock <= item.min_stock
      ? 'bg-red-100 text-red-800'
      : item.available_stock <= item.min_stock * 2
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-green-100 text-green-800';

  const statusText =
    item.available_stock <= item.min_stock
      ? '⚠️ Baixo'
      : item.available_stock <= item.min_stock * 2
      ? '⚠️ Atenção'
      : '✅ OK';

  return (
    <tr className="border-b">
      <td className="p-4 font-medium">{item.produto_name}</td>
      <td className="p-4">{item.current_stock}</td>
      <td className="p-4">{item.reserved_stock}</td>
      <td className="p-4 font-bold">{item.available_stock}</td>
      <td className="p-4">{item.min_stock}</td>
      <td className="p-4">
        <span className={`px-2 py-1 rounded text-sm ${statusColor}`}>
          {statusText}
        </span>
      </td>
      <td className="p-4">
        {showAdd ? (
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qtd"
              className="w-20 px-2 py-1 border rounded"
            />
            <button
              onClick={() => {
                if (quantity) {
                  onAddStock(item.produto_id, parseInt(quantity));
                  setQuantity('');
                  setShowAdd(false);
                }
              }}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              ✓
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setQuantity('');
              }}
              className="bg-gray-300 px-3 py-1 rounded"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            + Repor
          </button>
        )}
      </td>
    </tr>
  );
}
```

---

## 6. 🔌 BACKEND - API ENDPOINTS

### 6.1 Dashboard Controller

**Arquivo:** `backend/src/modules/dashboard/dashboard.controller.ts`

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('kpis')
  async getKPIs(@User() user: any) {
    return this.dashboardService.getKPIs(user.tenant_id);
  }

  @Get('sales-chart')
  async getSalesChart(
    @User() user: any,
    @Query('days') days: number = 7,
  ) {
    return this.dashboardService.getSalesChart(user.tenant_id, days);
  }

  @Get('top-products')
  async getTopProducts(@User() user: any) {
    return this.dashboardService.getTopProducts(user.tenant_id);
  }
}
```

---

## 7. ✅ CHECKLIST DE IMPLEMENTAÇÃO - PARTE 5

### 7.1 Frontend
- [ ] Criar página Dashboard com KPIs
- [ ] Criar página de Vendas
- [ ] Criar página de Clientes
- [ ] Criar página de Estoque
- [ ] Criar componentes de gráficos
- [ ] Implementar filtros e busca

### 7.2 Backend
- [ ] Criar `DashboardService`
- [ ] Criar `DashboardController`
- [ ] Implementar queries de KPIs
- [ ] Implementar queries de gráficos
- [ ] Otimizar queries (índices, cache)

### 7.3 Funcionalidades
- [ ] Atualização em tempo real (WebSocket ou polling)
- [ ] Exportação Excel/PDF
- [ ] Filtros avançados
- [ ] Ações rápidas (atualizar status, etc)

---

## 8. 📝 PRÓXIMOS PASSOS (Após Parte 5)

**PARTE 6:** Relatórios & Analytics Avançados
- Relatórios customizados
- Analytics detalhados
- Exportação de dados

---

**Status:** ✅ PARTE 5 COMPLETA  
**Próxima Parte:** PARTE 6 - Relatórios & Analytics
