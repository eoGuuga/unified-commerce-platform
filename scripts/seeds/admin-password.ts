/**
 * Senha do admin criado/atualizado pelo seed.
 * F12: SEMPRE do ambiente (`SEED_ADMIN_PASSWORD`), NUNCA um default publico.
 * Sem a var, o seed FALHA — nao cria admin com uma senha conhecida do codigo.
 */
export function requireAdminPassword(): string {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      'SEED_ADMIN_PASSWORD e obrigatorio: recusando criar/atualizar o admin com ' +
        'uma senha default publica. Defina SEED_ADMIN_PASSWORD (min 8, com letra ' +
        'e numero) antes de rodar o seed.',
    );
  }
  return password;
}
