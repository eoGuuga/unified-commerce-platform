import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mocka só o cliente HTTP (default), mantendo normalizeApiError + as mensagens
// reais (via importActual) — o useAuth passou a traduzir erros de login por elas.
vi.mock('@/lib/api-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    default: {
      login: vi.fn(),
      getCurrentUser: vi.fn(),
    },
  };
});

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

import { useAuth } from './useAuth';
import api, { API_ERROR_MESSAGES } from '@/lib/api-client';
import { jwtDecode } from 'jwt-decode';

/** Anexa status/code como o request<T>() do api-client faz de verdade. */
function apiError(message: string, extra: { status?: number; code?: string } = {}) {
  return Object.assign(new Error(message), extra);
}

const mockedApi = api as unknown as {
  login: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
};
const mockedJwtDecode = jwtDecode as unknown as ReturnType<typeof vi.fn>;

describe('useAuth', () => {
  // jsdom nao navega — stubamos window.location (o logout chama location.replace).
  let replaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    mockedApi.login.mockReset();
    mockedApi.getCurrentUser.mockReset();
    mockedJwtDecode.mockReset();
    replaceMock = vi.fn();
    vi.stubGlobal('location', {
      replace: replaceMock,
      assign: vi.fn(),
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    mockedApi.login.mockRejectedValue(apiError('Invalid credentials', { status: 401 }));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resp: { success: boolean; error?: string } | undefined;
    await act(async () => {
      resp = await result.current.login('a@b.com', 'wrong');
    });

    expect(resp?.success).toBe(false);
    expect(window.localStorage.getItem('token')).toBeNull();
  });

  // B1 — o login não pode vazar texto técnico do backend ("Invalid JWT"/401 cru).
  it('B1: credencial errada (401) vira "E-mail ou senha incorretos", nao vaza tecnico', async () => {
    mockedApi.login.mockRejectedValue(apiError('Invalid JWT: signature', { status: 401 }));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resp: { success: boolean; error?: string } | undefined;
    await act(async () => {
      resp = await result.current.login('a@b.com', 'wrong');
    });

    expect(resp?.success).toBe(false);
    expect(resp?.error).toBe(API_ERROR_MESSAGES.loginCredentials);
    expect(resp?.error).not.toMatch(/JWT|Invalid/i);
  });

  it('B1: erro de servidor (500) no login vira mensagem amigavel de servidor', async () => {
    mockedApi.login.mockRejectedValue(
      apiError('Internal server error', { status: 500 }),
    );

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resp: { success: boolean; error?: string } | undefined;
    await act(async () => {
      resp = await result.current.login('a@b.com', 'x');
    });

    expect(resp?.error).toBe(API_ERROR_MESSAGES.loginServer);
    expect(resp?.error).not.toMatch(/internal|server error/i);
  });

  // B1 — nunca logar o token no console (jwtDecode pode ecoar o token no erro).
  it('B1: token invalido no storage nao vaza para o console', async () => {
    const SECRET = 'eyJhbGciOiJIUzI1NiJ9.PAYLOAD_SUPER_SECRETO.assinatura';
    window.localStorage.setItem('token', SECRET);
    mockedJwtDecode.mockImplementation(() => {
      throw new Error(`Invalid token specified: ${SECRET}`);
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const loggedText = errorSpy.mock.calls
      .flat()
      .map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a)))
      .join(' ');
    expect(loggedText).not.toContain(SECRET);
    expect(loggedText).not.toContain('PAYLOAD_SUPER_SECRETO');
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

  it('logout redireciona para /login (evita o estado "zumbi" com useAuth por-instancia)', async () => {
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

    expect(replaceMock).toHaveBeenCalledWith('/login');
  });
});
