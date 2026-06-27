/**
 * Types de autenticacao.
 * Acompanha backend/src/database/entities/Usuario.entity.ts e o payload do JWT.
 */

export type UserRole = 'admin' | 'manager' | 'seller' | 'support';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  tenant_id: string;
  phone?: string;
  is_active?: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user?: User;
  /** Backend pode incluir campos extras de session/tenant. */
  [key: string]: unknown;
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  /** Consentimento LGPD obrigatorio: aceite dos Termos de Uso e Politica de Privacidade. */
  accept_terms: boolean;
}
