/**
 * Configurações do frontend
 * ⚠️ CRÍTICO: Credenciais devem vir sempre de variáveis de ambiente
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * ⚠️ DEPRECATED: Em desenvolvimento, usar credenciais apenas se configuradas via env
 * Em produção, essas credenciais devem vir sempre do contexto de autenticação
 */
export const DEV_CREDENTIALS = {
  email: process.env.NEXT_PUBLIC_DEV_EMAIL || '',
  password: process.env.NEXT_PUBLIC_DEV_PASSWORD || '',
  tenantId: process.env.NEXT_PUBLIC_DEV_TENANT_ID || '',
};

/**
 * Verifica se credenciais de desenvolvimento estão configuradas
 */
export function hasDevCredentials(): boolean {
  return !!(DEV_CREDENTIALS.email && DEV_CREDENTIALS.password && DEV_CREDENTIALS.tenantId);
}

/**
 * ⚠️ Aviso: Usar apenas em desenvolvimento e se configurado via env
 */
export function getDevCredentials() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Credenciais de desenvolvimento não devem ser usadas em produção');
  }
  
  if (!hasDevCredentials()) {
    throw new Error('Credenciais de desenvolvimento não configuradas. Configure NEXT_PUBLIC_DEV_EMAIL, NEXT_PUBLIC_DEV_PASSWORD e NEXT_PUBLIC_DEV_TENANT_ID');
  }
  
  return DEV_CREDENTIALS;
}
