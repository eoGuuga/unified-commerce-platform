'use client';

/**
 * usePdvSale — estado e logica da venda do balcao (o coracao testavel do PDV).
 *
 * Mantem fora do JSX: itens/total, metodo, valor recebido/troco, e a submissao
 * idempotente ao backend (`POST /orders`). A UI (Task 3+) so consome este hook.
 *
 * Invariantes (spec §6/§7, plano Global Constraints):
 *  - Idempotency-Key (UUID) gerada UMA vez por venda; retry apos erro REUSA a mesma key
 *    (anti-cobranca-dupla). `newSale` regenera a key para a proxima venda.
 *  - `paymentLoading` em voo bloqueia um 2o submit (duplo-clique nao dispara 2 POSTs).
 *  - Estoque insuficiente PRESERVA o carrinho — a operadora ajusta e tenta de novo.
 *    O caminho REAL do PDV e um 400 (BadRequestException) com a mensagem "Estoque
 *    insuficiente para produto ..." (pre-check do orders.service + reserve do
 *    stock-engine), SEM `code`. O `code:'INSUFFICIENT_STOCK'` (422) so existe no
 *    endpoint de movimento MANUAL de estoque, que o PDV nao usa — fica como fallback.
 *  - Preco divergente -> mensagem especifica de re-sync; carrinho preservado.
 */

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import api from '@/lib/api-client';
import type { PdvPaymentMethod } from '@/lib/types/order';
import {
  cartReducer,
  cartTotal,
  calcChange,
  type CartAction,
  type PdvAddableProduct,
  type PdvCartItem,
} from '@/lib/pdv/cart';
import { buildPdvOrderPayload } from '@/lib/pdv/build-order';

export interface CompletedSale {
  order_no: string;
  total: number;
  method: PdvPaymentMethod;
  change: number;
}

export interface UsePdvSaleResult {
  // Carrinho
  items: PdvCartItem[];
  total: number;
  addProduct: (product: PdvAddableProduct) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  // Pagamento
  method: PdvPaymentMethod;
  setMethod: (method: PdvPaymentMethod) => void;
  cashReceived: number;
  setCashReceived: (value: number) => void;
  change: number;
  // Estado da submissao
  paymentLoading: boolean;
  paymentError: string | null;
  completedSale: CompletedSale | null;
  beginPayment: () => void;
  submitSale: () => Promise<void>;
  newSale: () => void;
}

/** Opcoes da venda (nome do cliente do balcao, opcional — default "Cliente Balcão"). */
export interface UsePdvSaleOptions {
  customerName?: string;
}

/** Mensagem amigavel por tipo de erro do backend (spec §7). */
function describeSaleError(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? (error as { code?: string }).code
      : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  // Estoque insuficiente. No PDV o backend volta 400 com a mensagem "Estoque
  // insuficiente para produto ..." (sem code) — daí o match por regex. O
  // code:'INSUFFICIENT_STOCK' (422) vem de outro endpoint e fica como fallback.
  if (code === 'INSUFFICIENT_STOCK' || /estoque insuficiente/i.test(message)) {
    return 'Estoque insuficiente — ajuste a quantidade ou remova o item e tente de novo.';
  }
  // Preco divergente (400, sem code, message contem "divergente") -> re-sync.
  if (/diverg/i.test(message)) {
    return 'O preço de um item mudou. Atualize o produto e confira o total antes de cobrar.';
  }
  // Generico (rede/servidor): incentiva o retry seguro — a Idempotency-Key
  // estavel por venda evita cobranca dupla mesmo reenviando a mesma tentativa.
  return message
    ? `Não foi possível registrar a venda: ${message}`
    : 'Não foi possível registrar a venda. Pode tentar de novo — a idempotência evita cobrança dupla.';
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function usePdvSale(options?: UsePdvSaleOptions): UsePdvSaleResult {
  const [items, dispatch] = useReducer(cartReducer, [] as PdvCartItem[]);
  const [method, setMethod] = useState<PdvPaymentMethod>('dinheiro');
  const [cashReceived, setCashReceived] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  // Key idempotente: estavel por venda. Lazy — gerada na 1a vez que e lida (submit).
  const idempotencyKeyRef = useRef<string | null>(null);
  // Guarda sincrona contra duplo-clique (nao depende do re-render do paymentLoading).
  const inFlightRef = useRef(false);

  const total = useMemo(() => cartTotal(items), [items]);
  const change = useMemo(() => calcChange(total, cashReceived), [total, cashReceived]);

  const apply = useCallback((action: CartAction) => dispatch(action), []);

  const addProduct = useCallback(
    (product: PdvAddableProduct) => apply({ type: 'add', product }),
    [apply],
  );
  const inc = useCallback((id: string) => apply({ type: 'inc', id }), [apply]);
  const dec = useCallback((id: string) => apply({ type: 'dec', id }), [apply]);
  const remove = useCallback((id: string) => apply({ type: 'remove', id }), [apply]);
  const clear = useCallback(() => apply({ type: 'clear' }), [apply]);

  const beginPayment = useCallback(() => {
    // Recomeca o passo de pagamento limpo (sem arrastar erro anterior).
    setPaymentError(null);
  }, []);

  const submitSale = useCallback(async () => {
    // Guarda anti-duplo-POST: sincrona, antes de qualquer await.
    if (inFlightRef.current) return;
    if (items.length === 0) return;

    inFlightRef.current = true;
    setPaymentLoading(true);
    setPaymentError(null);

    // Gera a key UMA vez por venda; retry apos erro reusa a mesma.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = newIdempotencyKey();
    }
    const idempotencyKey = idempotencyKeyRef.current;

    // Snapshot do total/metodo no momento do submit (para o recibo).
    const saleTotal = total;
    const saleMethod = method;
    const saleChange = saleMethod === 'dinheiro' ? calcChange(saleTotal, cashReceived) : 0;

    try {
      const payload = buildPdvOrderPayload(items, saleMethod, options?.customerName);
      const order = await api.createOrder(payload, { idempotencyKey });
      setCompletedSale({
        order_no: order.order_no,
        total: saleTotal,
        method: saleMethod,
        change: saleChange,
      });
    } catch (error) {
      // Carrinho PRESERVADO de proposito — a operadora corrige e tenta de novo.
      setPaymentError(describeSaleError(error));
    } finally {
      inFlightRef.current = false;
      setPaymentLoading(false);
    }
  }, [items, total, method, cashReceived, options?.customerName]);

  const newSale = useCallback(() => {
    apply({ type: 'clear' });
    setMethod('dinheiro');
    setCashReceived(0);
    setPaymentError(null);
    setCompletedSale(null);
    setPaymentLoading(false);
    inFlightRef.current = false;
    // Proxima venda = nova key idempotente.
    idempotencyKeyRef.current = null;
  }, [apply]);

  return {
    items,
    total,
    addProduct,
    inc,
    dec,
    remove,
    clear,
    method,
    setMethod,
    cashReceived,
    setCashReceived,
    change,
    paymentLoading,
    paymentError,
    completedSale,
    beginPayment,
    submitSale,
    newSale,
  };
}
