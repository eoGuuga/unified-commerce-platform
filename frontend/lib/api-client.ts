import { API_BASE_URL, TENANT_ID } from './config';
import type {
  ApiErrorResponse,
  ConfirmPaymentResponse,
  CreateOrderInput,
  CreatePaymentInput,
  CreatePublicPaymentInput,
  CreateProductInput,
  LoginResponse,
  Order,
  OrderStatus,
  PaymentResponse,
  Product,
  PublicOrderTrackingResponse,
  RegisterInput,
  SalesReport,
  StockReservationResponse,
  StockSummary,
  UpdateProductInput,
  User,
} from './types';

interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

export interface PublicOrderTrackingPayload {
  order_no: string;
  customer_email?: string;
  customer_phone?: string;
}

function readStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('tenant_id');
}

function resolveTenantId(explicit?: string): string {
  return explicit || readStoredTenantId() || TENANT_ID;
}

function hasMessageMatching(error: unknown, pattern: RegExp): boolean {
  if (error instanceof Error) return pattern.test(error.message);
  if (typeof error === 'object' && error && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === 'string' && pattern.test(msg);
  }
  return false;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: ApiOptions = {},
  ): Promise<T> {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('token')
        : null;

    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const effectiveTenantId = readStoredTenantId() || TENANT_ID;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(effectiveTenantId ? { 'x-tenant-id': effectiveTenantId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((fetchOptions.headers as Record<string, string> | undefined) ?? {}),
    };

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => ({}))) as ApiErrorResponse;
      const err = new Error(errorBody.message || 'Request failed');
      // Preserva body.code para que hooks recebam erros tipados (ex.: INSUFFICIENT_STOCK).
      (err as Error & { code?: string }).code = (errorBody as { code?: string }).code;
      throw err;
    }

    return (await response.json()) as T;
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async login(
    email: string,
    password: string,
    tenantId?: string,
  ): Promise<LoginResponse> {
    const tid = resolveTenantId(tenantId);
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: tid ? { 'x-tenant-id': tid } : undefined,
    });
  }

  async register(data: RegisterInput, tenantId?: string): Promise<User> {
    const tid = resolveTenantId(tenantId);
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: tid ? { 'x-tenant-id': tid } : undefined,
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async getProducts(_tenantId: string, options?: { includeInactive?: boolean }): Promise<Product[]> {
    // Quando includeInactive=true o admin recebe todos os produtos (ativos + inativos),
    // permitindo que os filtros Ativos/Inativos/Todos e o toggle de reativação funcionem.
    const params: Record<string, string> = {};
    if (options?.includeInactive) {
      params.include_inactive = 'true';
    }
    return this.request<Product[]>('/products', Object.keys(params).length ? { params } : undefined);
  }

  async getPublicStoreProducts(tenantId?: string): Promise<Product[]> {
    const tid = resolveTenantId(tenantId);
    return this.request<Product[]>('/products/public/catalog', {
      headers: tid ? { 'x-tenant-id': tid } : undefined,
    });
  }

  async getProduct(id: string, _tenantId: string): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
  }

  async searchProducts(
    query: string,
    _tenantId: string,
  ): Promise<Product[]> {
    return this.request<Product[]>('/products/search', {
      params: { q: query },
    });
  }

  async createProduct(
    product: CreateProductInput,
    _tenantId: string,
  ): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(
    id: string,
    product: UpdateProductInput,
    _tenantId: string,
  ): Promise<Product> {
    return this.request<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(product),
    });
  }

  async getCategories(): Promise<string[]> {
    // Retorna lista de categorias disponíveis para os produtos do tenant.
    return this.request<string[]>('/products/categories');
  }

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------

  async createOrder(
    order: CreateOrderInput,
    _tenantId: string,
    idempotencyKey?: string,
  ): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : undefined,
    });
  }

  async createPublicOrder(
    order: CreateOrderInput,
    tenantId: string,
    idempotencyKey?: string,
  ): Promise<Order> {
    return this.request<Order>('/orders/public/checkout', {
      method: 'POST',
      body: JSON.stringify(order),
      headers: {
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
    });
  }

  async getOrders(_tenantId: string): Promise<Order[]> {
    return this.request<Order[]>('/orders');
  }

  async getOrder(id: string, _tenantId: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}`);
  }

  async updateOrderStatus(
    id: string,
    status: OrderStatus | string,
    _tenantId?: string,
  ): Promise<Order> {
    // Backend expoe PATCH /orders/:id/status (state machine valida a transicao
    // e dispara a notificacao WhatsApp ao cliente automaticamente).
    return this.request<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async trackPublicOrder(
    payload: PublicOrderTrackingPayload,
    tenantId?: string,
  ): Promise<PublicOrderTrackingResponse> {
    const tid = resolveTenantId(tenantId);
    return this.request<PublicOrderTrackingResponse>('/orders/public/track', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: tid ? { 'x-tenant-id': tid } : undefined,
    });
  }

  async getSalesReport(_tenantId: string): Promise<SalesReport> {
    try {
      return await this.request<SalesReport>('/orders/reports/sales');
    } catch (error) {
      if (hasMessageMatching(error, /Unauthorized|401/)) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------------

  async createPayment(
    payload: CreatePaymentInput,
    _tenantId: string,
  ): Promise<PaymentResponse> {
    return this.request<PaymentResponse>('/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createPublicPayment(
    payload: CreatePublicPaymentInput,
    tenantId: string,
  ): Promise<PaymentResponse> {
    return this.request<PaymentResponse>('/payments/public', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: tenantId ? { 'x-tenant-id': tenantId } : undefined,
    });
  }

  async confirmPayment(
    paymentId: string,
    _tenantId: string,
  ): Promise<ConfirmPaymentResponse> {
    return this.request<ConfirmPaymentResponse>(
      `/payments/${paymentId}/confirm`,
      { method: 'POST' },
    );
  }

  // ---------------------------------------------------------------------------
  // Stock
  // ---------------------------------------------------------------------------

  async reserveStock(
    productId: string,
    quantity: number,
    _tenantId: string,
  ): Promise<StockReservationResponse> {
    try {
      return await this.request<StockReservationResponse>(
        `/products/${productId}/reserve`,
        { method: 'POST', body: JSON.stringify({ quantity }) },
      );
    } catch (error) {
      if (hasMessageMatching(error, /Unauthorized|401/)) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw error;
    }
  }

  async releaseStock(
    productId: string,
    quantity: number,
    _tenantId: string,
  ): Promise<StockReservationResponse> {
    try {
      return await this.request<StockReservationResponse>(
        `/products/${productId}/release`,
        { method: 'POST', body: JSON.stringify({ quantity }) },
      );
    } catch (error) {
      if (hasMessageMatching(error, /Unauthorized|401/)) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw error;
    }
  }

  async getStockSummary(_tenantId: string): Promise<StockSummary> {
    return this.request<StockSummary>('/products/stock-summary');
  }

  async getStockHistory(
    productId: string,
    limit = 50,
    offset = 0,
  ): Promise<{
    items: Array<{
      tipo: string;
      delta: number;
      saldo_resultante: number;
      motivo: string | null;
      created_at: string;
    }>;
    total: number;
  }> {
    return this.request(`/products/${productId}/stock-history`, {
      params: { limit: String(limit), offset: String(offset) },
    });
  }

  /**
   * Ajuste de estoque com tipo tipado.
   * Corpo: { tipo, delta, motivo? }
   * Em erro 422 com code INSUFFICIENT_STOCK, o erro carrega err.code para o hook.
   */
  async adjustStock(
    productId: string,
    tipo: 'COMPRA' | 'PERDA' | 'DEVOLUCAO' | 'AJUSTE',
    delta: number,
    motivo?: string,
  ): Promise<{ saldo_resultante: number }> {
    return this.request<{ saldo_resultante: number }>(
      `/products/${productId}/adjust-stock`,
      { method: 'POST', body: JSON.stringify({ tipo, delta, motivo }) },
    );
  }

  /** Define o estoque mínimo de um produto (PATCH /products/:id/min-stock). */
  async setMinStock(
    productId: string,
    minStock: number,
  ): Promise<Product> {
    return this.request<Product>(`/products/${productId}/min-stock`, {
      method: 'PATCH',
      body: JSON.stringify({ min_stock: minStock }),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
