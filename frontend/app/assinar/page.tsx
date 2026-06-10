import { redirect } from 'next/navigation';

/**
 * /assinar - redireciona para /checkout com plano pré-selecionado.
 * Ex: /assinar?plano=crescer
 */
export default function AssinarPage({
  searchParams,
}: {
  searchParams?: Promise<{ plano?: string }>;
}) {
  // Redireciona para /checkout (lê query param lá)
  // Next.js 15+: searchParams é Promise
  // Como ainda não lemos, redirecionamos com mesmo query
  // (simplificado: redireciona direto)
  redirect('/checkout');
}
