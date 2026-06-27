import type { OrderStatus } from '@/lib/types/order';
import { getStatusMeta, type OrderStatusMeta } from '@/lib/order-status';

const TONE_CLASSES: Record<OrderStatusMeta['tone'], string> = {
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  red: 'bg-red-100 text-red-700 border-red-200',
};

export function StatusBadge({ status, admin = false }: { status: OrderStatus; admin?: boolean }) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONE_CLASSES[meta.tone]}`}
    >
      {admin ? meta.adminLabel : meta.label}
    </span>
  );
}
