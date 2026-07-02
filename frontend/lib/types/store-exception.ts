/**
 * Types das exceções de disponibilidade da loja (Camada 2 — feat/store-availability).
 *
 * Espelham o contrato do backend (T2):
 *  - GET  /availability-exceptions            -> StoreException[] (só as FUTURAS, ordenadas)
 *  - POST /availability-exceptions            -> StoreException  (upsert por (tenant,date))
 *  - DELETE /availability-exceptions/:id      -> remove
 *  - POST /availability-exceptions/close-today -> StoreException (closed para hoje)
 *
 * Fonte canônica do backend:
 *  - entity:  backend/src/database/entities/StoreAvailabilityException.entity.ts
 *  - dto:     backend/src/modules/availability/dto/create-store-exception.dto.ts
 */

/** Natureza da exceção: fechado o dia todo, ou horário especial pontual. */
export type StoreExceptionKind = 'closed' | 'custom_hours';

/**
 * Uma exceção de disponibilidade por-data.
 * `date` é a data civil no fuso da loja, em "YYYY-MM-DD".
 * `open`/`close` ("HH:MM") só são preenchidos quando `kind === 'custom_hours'`;
 * em `closed` vêm ambos `null`.
 */
export interface StoreException {
  id: string;
  date: string; // "YYYY-MM-DD"
  kind: StoreExceptionKind;
  open: string | null; // "HH:MM" | null
  close: string | null; // "HH:MM" | null
}

/**
 * Corpo do POST /availability-exceptions.
 * `open`/`close` obrigatórios quando `kind === 'custom_hours'`; proibidos em `closed`
 * (validação cruzada no DTO do backend). O backend faz upsert por (tenant, date).
 */
export interface CreateStoreExceptionInput {
  date: string; // "YYYY-MM-DD" (não-passado, R4)
  kind: StoreExceptionKind;
  open?: string; // "HH:MM"
  close?: string; // "HH:MM"
}
