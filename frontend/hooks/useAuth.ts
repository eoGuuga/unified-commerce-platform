'use client';

import { useState, useEffect, useCallback } from 'react';
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

/**
 * Hook para gerenciar autenticação e tenant_id
 * ⚠️ CRÍTICO: tenantId deve vir sempre do JWT, nunca hardcoded
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    tenantId: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Carregar token do localStorage ao montar
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (token) {
      // ✅ Decodificar JWT usando jwt-decode (suporta UTF-8 e caracteres especiais)
      try {
        const payload = jwtDecode<{ tenant_id?: string; exp?: number }>(token);
        const tenantId = payload.tenant_id;
        
        // Verificar se token expirou
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          // Token expirado, remover
          localStorage.removeItem('token');
          setAuthState({
            user: null,
            token: null,
            tenantId: null,
            isLoading: false,
            isAuthenticated: false,
          });
          return;
        }

        setAuthState({
          token,
          tenantId: tenantId || null,
          isLoading: true,
          isAuthenticated: !!tenantId,
          user: null, // Será carregado abaixo
        });

        // Carregar dados do usuário
        loadUser(token);
      } catch (error) {
        console.error('Erro ao decodificar token:', error);
        localStorage.removeItem('token');
        setAuthState({
          user: null,
          token: null,
          tenantId: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } else {
      setAuthState({
        user: null,
        token: null,
        tenantId: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const loadUser = async (token: string) => {
    try {
      const user = await api.getCurrentUser();
      // ✅ Decodificar JWT usando jwt-decode (suporta UTF-8 e caracteres especiais)
      const payload = jwtDecode<{ tenant_id?: string }>(token);
      const tenantId = payload.tenant_id || user.tenant_id;

      setAuthState({
        user: user as User,
        token,
        tenantId,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      localStorage.removeItem('token');
      setAuthState({
        user: null,
        token: null,
        tenantId: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const login = useCallback(async (email: string, password: string, tenantId?: string) => {
    try {
        const response = await api.login(email, password, tenantId);
      
      if (response.access_token && typeof window !== 'undefined') {
        localStorage.setItem('token', response.access_token);
        
        // ✅ Extrair tenant_id do JWT usando jwt-decode (suporta UTF-8 e caracteres especiais)
        const payload = jwtDecode<{ tenant_id?: string }>(response.access_token);
        const extractedTenantId = payload.tenant_id || tenantId;

        if (!extractedTenantId) {
          throw new Error('Tenant ID não encontrado no token JWT');
        }

          localStorage.setItem('tenant_id', extractedTenantId);
          await loadUser(response.access_token);

        return { success: true, tenantId: extractedTenantId };
      }
      
      throw new Error('Token não recebido');
    } catch (error: any) {
      console.error('Erro no login:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    setAuthState({
      user: null,
      token: null,
      tenantId: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  return {
    ...authState,
    login,
    logout,
  };
}
