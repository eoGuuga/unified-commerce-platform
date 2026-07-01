/**
 * Favoritos manuais do PDV (proxy de "mais vendidos" no v1 — spec §5.3).
 *
 * Persistência local por dispositivo via localStorage ('pdv:favorites').
 * Não é dado de tenant nem PII — é só uma preferência de UI do caixa.
 *
 * `orderByFavorites` é PURO (sem efeitos), separado do wrapper de storage
 * para ser testável e reusável na renderização da grade.
 */

const STORAGE_KEY = 'pdv:favorites';

/** Lê com segurança: storage indisponível ou JSON inválido → lista vazia. */
function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage cheio/bloqueado: silenciar — favoritos são best-effort.
  }
}

/** Ids dos produtos favoritados (vazio se nada salvo). */
export function listFavorites(): string[] {
  return readFavorites();
}

/**
 * Alterna o favorito do produto e persiste. Retorna a lista resultante
 * (favoritos novos vão para o fim; a ordem visual fica a cargo de quem renderiza).
 */
export function toggleFavorite(id: string): string[] {
  const current = readFavorites();
  const next = current.includes(id)
    ? current.filter((favId) => favId !== id)
    : [...current, id];
  writeFavorites(next);
  return next;
}

/**
 * Reordena `products` colocando os favoritos primeiro (na ordem de `favIds`) e
 * mantendo o restante na ordem original. Favoritos inexistentes em `products`
 * são ignorados. Puro: não muta a entrada.
 */
export function orderByFavorites<T extends { id: string }>(
  products: T[],
  favIds: string[],
): T[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const favSet = new Set(favIds);
  const favorites = favIds
    .map((id) => byId.get(id))
    .filter((p): p is T => p !== undefined);
  const rest = products.filter((p) => !favSet.has(p.id));
  return [...favorites, ...rest];
}
