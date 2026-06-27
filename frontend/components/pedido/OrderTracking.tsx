'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, Package } from 'lucide-react';
import api from '@/lib/api-client';
import {
  TIMELINE_SEQUENCE,
  getStatusMeta,
  getTimelineIndex,
} from '@/lib/order-status';
import type { PublicOrderTrackingResponse } from '@/lib/types/order';

function formatMoney(n: number): string {
  return `R$ ${Number(n ?? 0).toFixed(2)}`;
}

export function OrderTracking({ orderNo }: { orderNo: string | null }) {
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<PublicOrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(
    async (orderNoValue: string, contactValue: string) => {
      setLoading(true);
      setError(null);
      try {
        // O contato pode ser email ou telefone — mandamos no campo certo.
        const isEmail = contactValue.includes('@');
        const result = (await api.trackPublicOrder({
          order_no: orderNoValue,
          ...(isEmail
            ? { customer_email: contactValue.trim() }
            : { customer_phone: contactValue.trim() }),
        })) as unknown as PublicOrderTrackingResponse;
        setOrder(result);
      } catch {
        setError(
          'Pedido não encontrado ou os dados não conferem. Confira o número do pedido e o e-mail/telefone usado na compra.',
        );
        setOrder(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Auto-atualiza o status a cada 30s enquanto o pedido nao for terminal.
  useEffect(() => {
    if (!order || !orderNo) return;
    const meta = getStatusMeta(order.status);
    if (order.status === 'entregue' || order.status === 'cancelado') return;
    const id = setInterval(() => {
      void fetchOrder(orderNo, contact);
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, orderNo, contact]);

  if (!orderNo) {
    return (
      <Shell>
        <EmptyMessage>
          Link de pedido inválido. Use o link que você recebeu no WhatsApp para acompanhar.
        </EmptyMessage>
      </Shell>
    );
  }

  // Formulario de verificacao (antes de mostrar o pedido).
  if (!order) {
    return (
      <Shell>
        <div className="mx-auto max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
            Pedido #{orderNo}
          </p>
          <h1
            className="mt-4 text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Acompanhe seu <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>pedido</em>.
          </h1>
          <p className="mt-4 text-[15px] leading-[1.55] text-[#1a1814]/65">
            Para sua segurança, confirme o e-mail ou telefone usado na compra.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (contact.trim()) void fetchOrder(orderNo, contact);
            }}
            className="mt-8 flex flex-col gap-3"
          >
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="E-mail ou telefone da compra"
              className="h-12 rounded-full border border-[#1a1814]/15 bg-[#f6f3ee] px-5 text-[15px] text-[#1a1814] outline-none transition focus:border-[#1a1814]/40"
            />
            <button
              type="submit"
              disabled={loading || !contact.trim()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1a1814] px-6 text-[15px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Acompanhar pedido
            </button>
          </form>

          {error && <p className="mt-4 text-[14px] text-red-700">{error}</p>}
        </div>
      </Shell>
    );
  }

  // Pedido encontrado — mostra timeline + resumo.
  const currentIndex = getTimelineIndex(order.status);
  const isCanceled = order.status === 'cancelado';

  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
          Pedido #{order.order_no}
        </p>
        <h1
          className="mt-3 text-[clamp(1.8rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {getStatusMeta(order.status).label}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-[#1a1814]/65">
          {getStatusMeta(order.status).description}
        </p>

        {/* Timeline */}
        {isCanceled ? (
          <div className="mt-10 flex items-center gap-3 rounded-[4px] border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-700">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            Este pedido foi cancelado.
          </div>
        ) : (
          <ol className="mt-10 space-y-0">
            {TIMELINE_SEQUENCE.map((step, i) => {
              const meta = getStatusMeta(step);
              const done = i < currentIndex;
              const active = i === currentIndex;
              const isLast = i === TIMELINE_SEQUENCE.length - 1;
              return (
                <li key={step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    ) : active ? (
                      <div className="flex h-6 w-6 items-center justify-center">
                        <span className="h-3 w-3 animate-pulse rounded-full bg-[#b8654a]" />
                      </div>
                    ) : (
                      <Circle className="h-6 w-6 text-[#1a1814]/20" />
                    )}
                    {!isLast && (
                      <span
                        className={`my-1 w-px flex-1 ${done ? 'bg-emerald-300' : 'bg-[#1a1814]/12'}`}
                        style={{ minHeight: 28 }}
                      />
                    )}
                  </div>
                  <div className={`pb-7 ${active ? '' : done ? '' : 'opacity-50'}`}>
                    <p
                      className={`text-[16px] leading-tight ${active ? 'font-medium text-[#b8654a]' : 'text-[#1a1814]'}`}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {meta.adminLabel}
                    </p>
                    {active && (
                      <p className="mt-1 text-[13px] text-[#1a1814]/60">{meta.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* Resumo do pedido */}
        <div className="mt-8 rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-[#1a1814]/50" />
            <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55">
              Seu pedido
            </span>
          </div>
          <ul className="space-y-2">
            {order.items?.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-[14px] text-[#1a1814]/80">
                <span>
                  {item.quantity}× {item.product_name}
                </span>
                <span>{formatMoney(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-[#1a1814]/8 pt-3 text-[15px] font-medium text-[#1a1814]">
            <span>Total</span>
            <span>{formatMoney(order.total_amount)}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-[#1a1814]/45">
          Esta página atualiza sozinha. Você também recebe cada novidade no WhatsApp.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[1320px] px-6 py-16">{children}</main>;
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md text-center text-[15px] text-[#1a1814]/65">{children}</div>
  );
}
