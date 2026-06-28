/**
 * Layout raiz do painel admin.
 * A AdminShell cuida do auth-gate, provider e navegação responsiva.
 */
import { AdminShell } from '@/components/admin/shell/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
