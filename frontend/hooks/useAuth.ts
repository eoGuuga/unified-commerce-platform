'use client';

import { useCallback, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  tenant_id: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const EMPTY_AUTH_STATE: AuthState = {
  user: null,
  token: null,
  tenantId: null,
  isLoading: false,
  isAuthenticated: false,
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    ...EMPTY_AUTH_STATE,
    isLoading: true,
  });

  const clearSession = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('tenant_id');
  }, []);

  const resetAuthState = useCallback(() => {
    setAuthState(EMPTY_AUTH_STATE);
  }, []);

  const loadUser = useCallback(
    async (token: string) => {
      try {
        const user = await api.getCurrentUser();
        const payload = jwtDecode<{ tenant_id?: string }>(token);
        const tenantId = payload.tenant_id || (user as User).tenant_id;

        setAuthState({
          user: user as User,
          token,
          tenantId,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch (error) {
        console.error('Erro ao carregar usuario:', error);
        clearSession();
        resetAuthState();
      }
    },
    [clearSession, resetAuthState]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      resetAuthState();
      return;
    }

    try {
      const payload = jwtDecode<{ tenant_id?: string; exp?: number }>(token);
      const tenantId = payload.tenant_id;

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        clearSession();
        resetAuthState();
        return;
      }

      setAuthState({
        user: null,
        token,
        tenantId: tenantId || null,
        isLoading: true,
        isAuthenticated: Boolean(tenantId),
      });

      void loadUser(token);
    } catch (error) {
      console.error('Erro ao decodificar token:', error);
      clearSession();
      resetAuthState();
    }
  }, [clearSession, loadUser, resetAuthState]);

  const login = useCallback(
    async (email: string, password: string, tenantId?: string) => {
      try {
        const response = await api.login(email, password, tenantId);

        if (!response.access_token || typeof window === 'undefined') {
          throw new Error('Token nao recebido');
        }

        localStorage.setItem('token', response.access_token);

        const payload = jwtDecode<{ tenant_id?: string }>(response.access_token);
        const extractedTenantId = payload.tenant_id || tenantId;

        if (!extractedTenantId) {
          throw new Error('Tenant ID nao encontrado no token JWT');
        }

        localStorage.setItem('tenant_id', extractedTenantId);
        await loadUser(response.access_token);

        return { success: true, tenantId: extractedTenantId };
      } catch (error: any) {
        console.error('Erro no login:', error);
        clearSession();
        resetAuthState();
        return { success: false, error: error.message || 'Falha de autenticacao' };
      }
    },
    [clearSession, loadUser, resetAuthState]
  );

  const logout = useCallback(() => {
    clearSession();
    resetAuthState();
  }, [clearSession, resetAuthState]);

  return {
    ...authState,
    login,
    logout,
  };
}
