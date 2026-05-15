import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/api-client', () => ({
  default: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

import { useAuth } from './useAuth';
import api from '@/lib/api-client';
import { jwtDecode } from 'jwt-decode';

const mockedApi = api as unknown as {
  login: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
};
const mockedJwtDecode = jwtDecode as unknown as ReturnType<typeof vi.fn>;

describe('useAuth', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedApi.login.mockReset();
    mockedApi.getCurrentUser.mockReset();
    mockedJwtDecode.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inicia nao-autenticado quando nao ha token', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('descarta token expirado e limpa storage', async () => {
    window.localStorage.setItem('token', 'expired-token');
    window.localStorage.setItem('tenant_id', 'tenant-x');
    mockedJwtDecode.mockReturnValue({
      tenant_id: 'tenant-x',
      exp: Math.floor(Date.now() / 1000) - 60, // 60s atras
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.localStorage.getItem('tenant_id')).toBeNull();
  });

  it('login bem-sucedido grava token+tenant e marca autenticado', async () => {
    mockedApi.login.mockResolvedValue({ access_token: 'jwt-novo' });
    mockedApi.getCurrentUser.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'admin',
      tenant_id: 'tenant-1',
    });
    mockedJwtDecode.mockReturnValue({ tenant_id: 'tenant-1' });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resp: { success: boolean; tenantId?: string } | undefined;
    await act(async () => {
      resp = await result.current.login('a@b.com', 'pwd');
    });

    expect(resp?.success).toBe(true);
    expect(resp?.tenantId).toBe('tenant-1');
    expect(window.localStorage.getItem('token')).toBe('jwt-novo');
    expect(window.localStorage.getItem('tenant_id')).toBe('tenant-1');
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.email).toBe('a@b.com');
  });

  it('login falho retorna success=false e mantem storage limpo', async () => {
    mockedApi.login.mockRejectedValue(new Error('credenciais invalidas'));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resp: { success: boolean; error?: string } | undefined;
    await act(async () => {
      resp = await result.current.login('a@b.com', 'wrong');
    });

    expect(resp?.success).toBe(false);
    expect(resp?.error).toMatch(/credenciais/);
    expect(window.localStorage.getItem('token')).toBeNull();
  });

  it('logout limpa estado e storage', async () => {
    window.localStorage.setItem('token', 'jwt-valido');
    window.localStorage.setItem('tenant_id', 'tenant-1');
    mockedJwtDecode.mockReturnValue({
      tenant_id: 'tenant-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mockedApi.getCurrentUser.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'admin',
      tenant_id: 'tenant-1',
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(window.localStorage.getItem('token')).toBeNull();
  });
});
