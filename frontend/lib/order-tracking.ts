export const ORDER_TRACKING_SESSION_KEY = 'ucm:last-order-tracking';

export interface StoredOrderTrackingContext {
  orderNo: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
}

export function saveOrderTrackingContext(context: StoredOrderTrackingContext) {
  if (typeof window === 'undefined' || !context.orderNo) {
    return;
  }

  window.sessionStorage.setItem(ORDER_TRACKING_SESSION_KEY, JSON.stringify(context));
}

export function readOrderTrackingContext(orderNo?: string): StoredOrderTrackingContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(ORDER_TRACKING_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredOrderTrackingContext;
    if (!parsed?.orderNo) {
      return null;
    }

    if (orderNo && parsed.orderNo !== orderNo) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearOrderTrackingContext(orderNo?: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const current = readOrderTrackingContext(orderNo);
  if (current) {
    window.sessionStorage.removeItem(ORDER_TRACKING_SESSION_KEY);
  }
}
