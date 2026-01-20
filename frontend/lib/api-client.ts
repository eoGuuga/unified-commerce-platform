import { API_BASE_URL, TENANT_ID } from './config';

// ⚠️ REMOVIDO: Credenciais hardcoded - devem vir do contexto JWT ou variáveis de ambiente

interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Default genérico = any para evitar "unknown" espalhando no app.
  // (Podemos evoluir para tipagem forte por endpoint depois.)
  private async request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const storedTenantId =
      typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
    const effectiveTenantId = storedTenantId || TENANT_ID;

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(effectiveTenantId && { 'x-tenant-id': effectiveTenantId }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOptions.headers,
    };

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string, tenantId?: string) {
    const tid =
      tenantId ||
      (typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null) ||
      TENANT_ID;
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: tid ? { 'x-tenant-id': tid } : undefined,
    });
  }

  async register(data: { email: string; password: string; full_name: string }, tenantId?: string) {
    const tid =
      tenantId ||
      (typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null) ||
      TENANT_ID;
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: tid ? { 'x-tenant-id': tid } : undefined,
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Products endpoints
  async getProducts(_tenantId: string) {
    return this.request('/products');
  }

  async getProduct(id: string, _tenantId: string) {
    return this.request(`/products/${id}`);
  }

  async searchProducts(query: string, _tenantId: string) {
    return this.request('/products/search', { params: { q: query } });
  }

  async createProduct(product: any, _tenantId: string) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, product: any, _tenantId: string) {
    return this.request(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(product),
    });
  }

  // Orders endpoints
  async createOrder(order: any, _tenantId: string) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getOrders(_tenantId: string) {
    return this.request('/orders');
  }

  async getOrder(id: string, _tenantId: string) {
    return this.request(`/orders/${id}`);
  }

  async updateOrderStatus(id: string, status: string, _tenantId: string) {
    return this.request(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getSalesReport(_tenantId: string) {
    try {
      return await this.request('/orders/reports/sales');
    } catch (error: any) {
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        // ⚠️ REMOVIDO: Login automático com credenciais hardcoded
        // Em produção, redirecionar para página de login
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw error;
    }
  }

  // Stock reservation endpoints
  async reserveStock(productId: string, quantity: number, _tenantId: string) {
    try {
      return await this.request(`/products/${productId}/reserve`, {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      });
    } catch (error: any) {
      // Se for erro de autenticação, não fazer login automático
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        // ⚠️ REMOVIDO: Login automático com credenciais hardcoded
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw error;
    }
  }

  async releaseStock(productId: string, quantity: number, _tenantId: string) {
    try {
      return await this.request(`/products/${productId}/release`, {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      });
    } catch (error: any) {
      // ✅ Segurança: nunca fazer login automático com credenciais hardcoded.
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
      throw error;
    }
  }

  // Stock management endpoints
  async getStockSummary(_tenantId: string) {
    return this.request('/products/stock-summary');
  }

  async adjustStock(productId: string, quantity: number, _tenantId: string, reason?: string) {
    return this.request(`/products/${productId}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ quantity, reason }),
    });
  }

  async setMinStock(productId: string, minStock: number, _tenantId: string) {
    return this.request(`/products/${productId}/min-stock`, {
      method: 'PATCH',
      body: JSON.stringify({ min_stock: minStock }),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;

