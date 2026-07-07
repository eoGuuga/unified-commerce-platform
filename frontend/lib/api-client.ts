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
import type {
  TenantSettingsProjection,
  UpdateTenantSettingsDto,
} from './types/tenant-settings';
import type {
  StoreException,
  CreateStoreExceptionInput,
} from './types/store-exception';

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

// ---------------------------------------------------------------------------
// Normalização de erros de API (conserto de raiz — "Internal server error" cru)
// ---------------------------------------------------------------------------

/**
 * Mensagens amigáveis em pt-BR. A whitelist é o contrato: normalizeApiError()
 * NUNCA retorna texto técnico cru do backend (JWT, "Internal server error",
 * HTML, stack) — só uma destas ou um fallback amigável dado pelo chamador.
 */
export const API_ERROR_MESSAGES = {
  network: 'Sem conexão. Verifique sua internet e tente novamente.',
  server: 'Não foi possível concluir agora. Tente novamente em instantes.',
  loginServer: 'Não foi possível entrar. Tente novamente.',
  loginCredentials: 'E-mail ou senha incorretos.',
  sessionExpired: 'Sua sessão expirou. Faça login novamente.',
  forbidden: 'Você não tem permissão para essa ação.',
  invalid: 'Dados inválidos. Confira os campos e tente novamente.',
  notFound: 'Não encontramos o que você procura.',
  rateLimit: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  generic: 'Algo deu errado. Tente novamente.',
} as const;

/** Mensagens específicas por código estruturado do backend (têm precedência). */
export const API_ERROR_CODE_MESSAGES: Record<string, string> = {
  INSUFFICIENT_STOCK: 'Estoque insuficiente para essa quantidade.',
};

export interface NormalizeApiErrorOptions {
  /** 'login': 401/400/422 viram "e-mail ou senha incorretos"; 5xx vira a msg de login. */
  context?: 'login';
  /** Fallback amigável do chamador p/ casos não classificáveis (nunca texto cru). */
  fallback?: string;
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

function extractCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error && 'code' in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return undefined;
}

function isNetworkError(error: unknown): boolean {
  // fetch() rejeita com TypeError quando a rede falha (antes de haver status).
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    return /failed to fetch|networkerror|load failed|network request failed/i.test(
      error.message,
    );
  }
  return false;
}

/**
 * Traduz QUALQUER erro de API para uma mensagem amigável em pt-BR. Decide só por
 * status HTTP + código estruturado, escolhendo de uma whitelist fixa — o texto
 * cru do backend nunca chega ao usuário.
 */
export function normalizeApiError(
  error: unknown,
  options: NormalizeApiErrorOptions = {},
): string {
  const M = API_ERROR_MESSAGES;

  // 1. Código estruturado do backend tem precedência (mensagem específica conhecida).
  const code = extractCode(error);
  if (code && API_ERROR_CODE_MESSAGES[code]) return API_ERROR_CODE_MESSAGES[code];

  // 2. Sem status → rede (fetch não completou) ou erro desconhecido.
  const status = extractStatus(error);
  if (status === undefined) {
    if (isNetworkError(error)) return M.network;
    return options.fallback ?? M.generic;
  }

  // 3. Por faixa/código de status HTTP.
  if (status >= 500) return options.context === 'login' ? M.loginServer : M.server;
  if (status === 401) {
    return options.context === 'login' ? M.loginCredentials : M.sessionExpired;
  }
  if (status === 400 || status === 422) {
    return options.context === 'login' ? M.loginCredentials : M.invalid;
  }
  if (status === 403) return M.forbidden;
  if (status === 404) return options.fallback ?? M.notFound;
  if (status === 429) return M.rateLimit;
  return options.fallback ?? M.generic;
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
      const err = new Error(errorBody.message || 'Request failed') as Error & {
        status?: number;
        code?: string;
      };
      // Preserva o status HTTP + body.code para o consumidor classificar via
      // normalizeApiError (401 → sessão, 403 → permissão, code INSUFFICIENT_STOCK
      // → mensagem específica) sem depender do texto cru da mensagem.
      err.status = response.status;
      err.code = (errorBody as { code?: string }).code;
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

  /**
   * Revoga o token atual no servidor (denylist por jti). Best-effort: o cliente
   * limpa a sessao de qualquer forma, entao falha aqui nunca bloqueia o logout.
   */
  async logout(): Promise<void> {
    try {
      await this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } catch {
      // silencioso de proposito: logout do cliente prossegue mesmo se o servidor falhar
    }
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
    input: CreateOrderInput,
    opts?: { idempotencyKey?: string },
  ): Promise<Order> {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(input),
      // Mesmo padrao do checkout publico: encaminha Idempotency-Key quando dado
      // (anti-cobranca-dupla; o backend autenticado ja honra esse header).
      headers: opts?.idempotencyKey
        ? { 'Idempotency-Key': opts.idempotencyKey }
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

  // ---------------------------------------------------------------------------
  // Tenant settings (tela de Configurações da Loja)
  // ---------------------------------------------------------------------------

  /**
   * Projeção allow-list das configurações do tenant autenticado (§2.1).
   * O escopo é sempre o `user.tenant_id` do JWT — o backend nunca lê o tenant do body.
   * O header `x-tenant-id` e o Bearer já são injetados por `request<T>()`.
   */
  async getSettings(): Promise<TenantSettingsProjection> {
    return this.request<TenantSettingsProjection>('/tenants/settings');
  }

  /**
   * Atualiza as configurações do tenant por seção (§2.2). Cada seção/campo é opcional;
   * seção ausente não é tocada. Requer role admin (guard no backend). Retorna a
   * projeção atualizada (verdade canônica) para o hook refletir no estado.
   */
  async updateSettings(
    dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettingsProjection> {
    return this.request<TenantSettingsProjection>('/tenants/settings', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  }

  // ---------------------------------------------------------------------------
  // Availability exceptions (exceções / feriados — Camada 2)
  // ---------------------------------------------------------------------------

  /**
   * Lista as exceções FUTURAS (`date >= hoje` no fuso da loja), ordenadas.
   * Escopo sempre pelo `user.tenant_id` do JWT — o backend nunca lê o tenant do body.
   * O header `x-tenant-id` e o Bearer já são injetados por `request<T>()`.
   */
  async listExceptions(): Promise<StoreException[]> {
    return this.request<StoreException[]>('/availability-exceptions');
  }

  /**
   * Cria (upsert por `(tenant, date)`) uma exceção. Requer role admin (guard no
   * backend). O backend rejeita datas no passado. Retorna a exceção persistida
   * (verdade canônica, com id) para o hook refletir no estado.
   */
  async createException(
    input: CreateStoreExceptionInput,
  ): Promise<StoreException> {
    return this.request<StoreException>('/availability-exceptions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /** Remove a exceção pelo id (escopo do tenant no backend). */
  async removeException(id: string): Promise<void> {
    return this.request<void>(`/availability-exceptions/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Atalho: cria (upsert) uma exceção `closed` para hoje (fuso da loja).
   * Retorna a exceção criada.
   */
  async closeToday(): Promise<StoreException> {
    return this.request<StoreException>(
      '/availability-exceptions/close-today',
      { method: 'POST' },
    );
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
