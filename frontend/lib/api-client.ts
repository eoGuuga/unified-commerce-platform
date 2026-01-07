const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOptions.headers,
    };

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: { email: string; password: string; full_name: string }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Products endpoints
  async getProducts(tenantId: string) {
    return this.request('/products', { params: { tenantId } });
  }

  async getProduct(id: string, tenantId: string) {
    return this.request(`/products/${id}`, { params: { tenantId } });
  }

  async searchProducts(query: string, tenantId: string) {
    return this.request('/products/search', { params: { q: query, tenantId } });
  }

  async createProduct(product: any, tenantId: string) {
    return this.request('/products', {
      method: 'POST',
      params: { tenantId },
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, product: any, tenantId: string) {
    return this.request(`/products/${id}`, {
      method: 'PATCH',
      params: { tenantId },
      body: JSON.stringify(product),
    });
  }

  // Orders endpoints
  async createOrder(order: any, tenantId: string) {
    return this.request('/orders', {
      method: 'POST',
      params: { tenantId },
      body: JSON.stringify(order),
    });
  }

  async getOrders(tenantId: string) {
    return this.request('/orders', { params: { tenantId } });
  }

  async getOrder(id: string, tenantId: string) {
    return this.request(`/orders/${id}`, { params: { tenantId } });
  }

  async updateOrderStatus(id: string, status: string, tenantId: string) {
    return this.request(`/orders/${id}`, {
      method: 'PATCH',
      params: { tenantId },
      body: JSON.stringify({ status }),
    });
  }

  async getSalesReport(tenantId: string) {
    return this.request('/orders/reports/sales', { params: { tenantId } });
  }

  // Stock reservation endpoints
  async reserveStock(productId: string, quantity: number, tenantId: string) {
    return this.request(`/products/${productId}/reserve`, {
      method: 'POST',
      params: { tenantId },
      body: JSON.stringify({ quantity }),
    });
  }

  async releaseStock(productId: string, quantity: number, tenantId: string) {
    return this.request(`/products/${productId}/release`, {
      method: 'POST',
      params: { tenantId },
      body: JSON.stringify({ quantity }),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;

