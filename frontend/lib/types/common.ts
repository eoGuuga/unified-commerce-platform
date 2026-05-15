/**
 * Types compartilhados / utilitarios da camada de API.
 */

export interface ApiErrorResponse {
  message?: string;
  error?: string;
  statusCode?: number;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}
