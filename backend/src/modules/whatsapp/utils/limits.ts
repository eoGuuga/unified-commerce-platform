/**
 * Limites de validacao do bot WhatsApp.
 * Centralizados para permitir override por tenant no futuro.
 */

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_NAME_LENGTH = 100;
export const MIN_NAME_LENGTH = 3;
export const MAX_ADDRESS_LENGTH = 500;
export const MIN_ADDRESS_LENGTH = 10;
export const MAX_NOTES_LENGTH = 500;
export const MAX_QUANTITY = 1000;
export const MIN_QUANTITY = 1;
export const MAX_PRICE = 1_000_000; // R$ 1.000.000,00

export const CATALOG_CATEGORY_PAGE_SIZE = 5;
export const CATALOG_PRODUCT_PAGE_SIZE = 6;
