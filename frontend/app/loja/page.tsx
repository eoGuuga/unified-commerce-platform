'use client';

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Boxes,
  CheckCircle2,
  Compass,
  Copy,
  CreditCard,
  MapPin,
  Minus,
  Package2,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import api from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { TENANT_ID, getDevCredentials, hasDevCredentials } from '@/lib/config';
import { saveOrderTrackingContext } from '@/lib/order-tracking';

interface Product {
  id: string;
  name: string;
  price: string;
  description?: string;
  stock?: number;
  available_stock?: number;
  reserved_stock?: number;
  min_stock?: number;
  categoria?: {
    id: string;
    name: string;
  };
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CustomerAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  deliveryType: 'delivery' | 'pickup';
  notes: string;
  address: CustomerAddress;
}

interface CheckoutSnapshot {
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

type PaymentMethod = 'pix' | 'dinheiro';

interface PaymentResult {
  pagamento: {
    id: string;
    status: string;
    method: PaymentMethod;
    amount: number | string;
  };
  qr_code?: string;
  qr_code_url?: string;
  copy_paste?: string;
  message?: string;
}

interface CreatedOrder {
  id: string;
  total: number;
  orderNo?: string;
}

interface CheckoutSuccessState {
  orderNo?: string;
  total: number;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryType: CustomerInfo['deliveryType'];
  changeAmount?: number;
}

const EMPTY_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const DELIVERY_FEE = 10;
const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'Loja Modelo GTSoftHub';
const STORE_TAGLINE =
  'Uma experiencia de compra feita para inspirar confianca: estoque sincronizado, checkout claro e pagamento sem atrito.';

const PRODUCT_PALETTES = [
  {
    gradient: 'from-emerald-400/22 via-cyan-400/12 to-transparent',
    accent: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(16,185,129,0.65)]',
  },
  {
    gradient: 'from-sky-400/22 via-blue-400/12 to-transparent',
    accent: 'bg-sky-400/15 text-sky-200 border-sky-400/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(56,189,248,0.6)]',
  },
  {
    gradient: 'from-amber-300/22 via-orange-400/12 to-transparent',
    accent: 'bg-amber-300/15 text-amber-100 border-amber-300/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(251,191,36,0.55)]',
  },
  {
    gradient: 'from-fuchsia-400/22 via-violet-400/12 to-transparent',
    accent: 'bg-fuchsia-400/15 text-fuchsia-100 border-fuchsia-400/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(232,121,249,0.55)]',
  },
];

const initialCustomerInfo: CustomerInfo = {
  name: '',
  email: '',
  phone: '',
  deliveryType: 'delivery',
  notes: '',
  address: {
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipcode: '',
  },
};

const controlClassName =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/10';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getAvailableUnits(product: Pick<Product, 'stock' | 'available_stock'>) {
  return Math.max(0, product.available_stock ?? product.stock ?? 0);
}

function getProductPalette(index: number) {
  return PRODUCT_PALETTES[index % PRODUCT_PALETTES.length];
}

function getRelevanceScore(product: Product, query: string) {
  if (!query) return 0;

  const normalizedQuery = query.trim().toLowerCase();
  const name = product.name.toLowerCase();
  const description = (product.description || '').toLowerCase();

  if (name.startsWith(normalizedQuery)) return 3;
  if (name.includes(normalizedQuery)) return 2;
  if (description.includes(normalizedQuery)) return 1;
  return 0;
}

function getStockTone(stock: number, minStock = 0) {
  if (stock <= 0) {
    return {
      label: 'Sem estoque',
      detail: 'Reposicao em andamento',
      className: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
    };
  }

  if ((minStock > 0 && stock <= minStock) || stock <= 3) {
    return {
      label: 'Ultimas unidades',
      detail: `${stock} disponiveis agora`,
      className: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    };
  }

  return {
    label: 'Pronta entrega',
    detail: `${stock} disponiveis para venda`,
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
  };
}

function getPaymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Aguardando pagamento',
    approved: 'Pagamento aprovado',
    confirmed: 'Pagamento confirmado',
    paid: 'Pagamento aprovado',
    cancelled: 'Pagamento cancelado',
    rejected: 'Pagamento recusado',
  };

  return labels[status] || status;
}

function getPaymentMethodLabel(method: PaymentMethod) {
  return method === 'pix' ? 'Pix' : 'Dinheiro';
}

function getDeliveryTypeLabel(deliveryType: CustomerInfo['deliveryType']) {
  return deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-accent">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 text-sm',
        strong ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span>{label}</span>
      <span className={cn(strong && 'text-lg font-semibold tracking-tight')}>{value}</span>
    </div>
  );
}

export default function LojaPage() {
  const router = useRouter();
  const { tenantId, isLoading: authLoading, login } = useAuth();
  const fallbackTenantId = TENANT_ID !== EMPTY_TENANT_ID ? TENANT_ID : null;
  const activeTenantId = tenantId || fallbackTenantId;
  const isOperatorPreview = Boolean(tenantId);

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'relevancia' | 'preco_asc' | 'preco_desc' | 'disponibilidade'
  >('relevancia');
  const [hydrated, setHydrated] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(initialCustomerInfo);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [couponCode, setCouponCode] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentResult | null>(null);
  const [checkoutSnapshot, setCheckoutSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<CheckoutSuccessState | null>(null);
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState<string | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const autoLogin = async () => {
      if (authLoading || activeTenantId) return;

      const isDevelopment = process.env.NODE_ENV === 'development';
      const allowAutoLogin = process.env.NEXT_PUBLIC_ALLOW_AUTO_LOGIN === 'true';

      if (!isDevelopment || !allowAutoLogin || !hasDevCredentials()) return;

      try {
        const devCreds = getDevCredentials();
        await login(devCreds.email, devCreds.password, devCreds.tenantId);
      } catch (error) {
        console.error('[DEV] auto-login error:', error);
      }
    };

    void autoLogin();
  }, [activeTenantId, authLoading, login]);

  useEffect(() => {
    if (authLoading) return;

    if (!activeTenantId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const data = isOperatorPreview
          ? await api.getProducts(activeTenantId)
          : await api.getPublicStoreProducts(activeTenantId);
        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error loading products:', error);
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTenantId, authLoading, isOperatorPreview]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCart = localStorage.getItem('loja_cart');
    const storedCustomer = localStorage.getItem('loja_customer');

    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch {
        localStorage.removeItem('loja_cart');
      }
    }

    if (storedCustomer) {
      try {
        setCustomerInfo(JSON.parse(storedCustomer));
      } catch {
        localStorage.removeItem('loja_customer');
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    localStorage.setItem('loja_cart', JSON.stringify(cart));
    localStorage.setItem('loja_customer', JSON.stringify(customerInfo));
  }, [cart, customerInfo, hydrated]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cartQuantityById = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => map.set(item.id, item.quantity));
    return map;
  }, [cart]);

  const getAvailableStock = (productId: string) => {
    const product = productById.get(productId);
    return product ? getAvailableUnits(product) : undefined;
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = customerInfo.deliveryType === 'delivery' ? DELIVERY_FEE : 0;
  const checkoutTotal = subtotal + deliveryFee;
  const payableTotal = createdOrder?.total ?? checkoutTotal;

  const cashReceivedNumber = parseCurrencyInput(cashReceived);
  const cashChange =
    Number.isFinite(cashReceivedNumber) && cashReceivedNumber > 0
      ? Math.max(0, cashReceivedNumber - payableTotal)
      : 0;

  const catalogStats = useMemo(() => {
    const readyProducts = products.filter((product) => getAvailableUnits(product) > 0);
    const lowStockProducts = products.filter((product) => {
      const available = getAvailableUnits(product);
      const minStock = product.min_stock ?? 0;
      return available > 0 && ((minStock > 0 && available <= minStock) || available <= 3);
    });
    const categoryCount = new Set(
      products.map((product) => product.categoria?.name).filter(Boolean),
    ).size;

    return {
      readyProducts: readyProducts.length,
      lowStockProducts: lowStockProducts.length,
      categoryCount,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (!query) return true;

      return (
        product.name.toLowerCase().includes(query) ||
        (product.description || '').toLowerCase().includes(query) ||
        product.categoria?.name?.toLowerCase().includes(query)
      );
    });
  }, [deferredSearchQuery, products]);

  const sortedProducts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const list = [...filteredProducts];

    list.sort((a, b) => {
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      const stockA = getAvailableUnits(a);
      const stockB = getAvailableUnits(b);

      if (sortBy === 'preco_asc') return priceA - priceB;
      if (sortBy === 'preco_desc') return priceB - priceA;
      if (sortBy === 'disponibilidade') return stockB - stockA;

      const relevance = getRelevanceScore(b, query) - getRelevanceScore(a, query);
      if (relevance !== 0) return relevance;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return list;
  }, [deferredSearchQuery, filteredProducts, sortBy]);

  const summaryItems = paymentData ? checkoutSnapshot?.items || [] : cart;
  const summarySubtotal = paymentData ? checkoutSnapshot?.subtotal || 0 : subtotal;
  const summaryDeliveryFee = paymentData ? checkoutSnapshot?.deliveryFee || 0 : deliveryFee;
  const summaryTotal = paymentData ? checkoutSnapshot?.total || payableTotal : checkoutTotal;
  const hasLockedCheckout = Boolean(createdOrder) && !checkoutSuccess;
  const hasActiveCheckoutSession = hasLockedCheckout || Boolean(paymentData);
  const storefrontJourney = [
    {
      key: 'catalog',
      label: 'catalogo',
      title: products.length > 0 ? 'A vitrine ja esta viva' : 'A vitrine precisa do primeiro destaque',
      description:
        products.length > 0
          ? `${products.length} produto(s) ja criam uma experiencia pronta para ser explorada.`
          : 'Assim que o primeiro produto entrar, esta pagina ja entrega uma experiencia comercial mais madura.',
      ready: products.length > 0,
      icon: <Boxes className="size-4" />,
    },
    {
      key: 'cart',
      label: 'carrinho',
      title: cartCount > 0 ? 'O pedido ja ganhou forma' : 'Falta so o primeiro item no carrinho',
      description:
        cartCount > 0
          ? `${cartCount} item(ns) ja seguem para um checkout claro e sem atrito.`
          : 'Adicione um produto e sinta como a experiencia conduz naturalmente para o checkout.',
      ready: cartCount > 0,
      icon: <ShoppingBag className="size-4" />,
    },
    {
      key: 'checkout',
      label: 'checkout',
      title: paymentData ? 'O pagamento ja foi acionado' : 'Pagamento pronto para encantar',
      description:
        paymentData
          ? 'Resumo, valor e confirmacao ja estao organizados para concluir com confianca.'
          : 'Pix, dinheiro, entrega e retirada ja falam a linguagem de uma operacao essencial.',
      ready: Boolean(paymentData),
      icon: <Rocket className="size-4" />,
    },
  ];
  const storefrontJourneyDone = storefrontJourney.filter((step) => step.ready).length;
  const storefrontJourneyProgress = Math.round(
    (storefrontJourneyDone / storefrontJourney.length) * 100,
  );

  const resetPaymentState = () => {
    setPaymentMethod('pix');
    setCouponCode('');
    setCashReceived('');
    setPaymentError(null);
    setCreatedOrder(null);
    setPaymentData(null);
    setCheckoutSnapshot(null);
    setCheckoutSuccess(null);
    setCheckoutIdempotencyKey(null);
  };

  const getCheckoutIdempotencyKey = () => {
    if (checkoutIdempotencyKey) {
      return checkoutIdempotencyKey;
    }

    const nextKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `loja-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    setCheckoutIdempotencyKey(nextKey);
    return nextKey;
  };

  const handleAddToCart = (product: Product) => {
    if (hasLockedCheckout) {
      toast.error(
        'Este pedido ja foi criado. Retome o checkout atual para concluir o pagamento antes de alterar o carrinho.',
      );
      setShowCheckout(true);
      return;
    }

    const availableStock = getAvailableUnits(product);
    if (availableStock <= 0) {
      toast.error('Produto sem estoque disponivel.');
      return;
    }

    const existing = cart.find((item) => item.id === product.id);
    const nextQuantity = existing ? existing.quantity + 1 : 1;

    if (nextQuantity > availableStock) {
      toast.error(`Estoque insuficiente. Disponivel: ${availableStock}`);
      return;
    }

    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQuantity } : item,
        ),
      );
      toast.success('Quantidade atualizada no carrinho.');
      return;
    }

    setCart([
      ...cart,
      {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
      },
    ]);
    toast.success('Produto adicionado ao carrinho.');
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (hasLockedCheckout) {
      toast.error(
        'O carrinho fica travado enquanto existe um pedido aberto. Retome o checkout atual para concluir o pagamento.',
      );
      setShowCheckout(true);
      return;
    }

    if (quantity <= 0) {
      setCart(cart.filter((item) => item.id !== id));
      return;
    }

    const availableStock = getAvailableStock(id);
    if (availableStock !== undefined && quantity > availableStock) {
      toast.error(`Estoque insuficiente. Disponivel: ${availableStock}`);
      return;
    }

    setCart(cart.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const handleClearCart = () => {
    if (hasLockedCheckout) {
      toast.error(
        'Este pedido ja existe. Retome o checkout atual ou acompanhe o pedido em vez de limpar o carrinho.',
      );
      setShowCheckout(true);
      setShowCart(false);
      return;
    }

    setCart([]);
    setShowCart(false);
    setShowCheckout(false);
    resetPaymentState();
  };

  const validateCustomerData = () => {
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      toast.error('Preencha nome, email e telefone.');
      return false;
    }

    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(phoneDigits)) {
      toast.error('Telefone invalido. Use DDD + numero com 10 ou 11 digitos.');
      return false;
    }

    if (customerInfo.deliveryType === 'delivery') {
      const { street, number, neighborhood, city, state, zipcode } = customerInfo.address;
      if (!street || !number || !neighborhood || !city || !state || !zipcode) {
        toast.error('Preencha o endereco completo para entrega.');
        return false;
      }
    }

    return true;
  };

  const validateCartStock = () => {
    const invalidItems: string[] = [];

    cart.forEach((item) => {
      const availableStock = getAvailableStock(item.id);
      if (availableStock !== undefined && item.quantity > availableStock) {
        invalidItems.push(`${item.name} (disp: ${availableStock})`);
      }
    });

    if (invalidItems.length > 0) {
      toast.error(`Estoque insuficiente para: ${invalidItems.join(', ')}`);
      return false;
    }

    return true;
  };

  const handleCopyPixCode = async () => {
    if (!paymentData?.copy_paste) return;

    try {
      await navigator.clipboard.writeText(paymentData.copy_paste);
      toast.success('Codigo Pix copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o codigo Pix.');
    }
  };

  const handleCopyCheckoutReceipt = async () => {
    if (!checkoutSuccess && !createdOrder) {
      toast.error('Ainda nao existe um pedido para gerar comprovante.');
      return;
    }

    const receiptOrderNo = checkoutSuccess?.orderNo || createdOrder?.orderNo || 'Pedido criado';
    const receiptCustomerName = checkoutSuccess?.customerName || customerInfo.name || 'Cliente';
    const receiptPaymentMethod = checkoutSuccess?.paymentMethod || paymentMethod;
    const receiptDeliveryType = checkoutSuccess?.deliveryType || customerInfo.deliveryType;
    const receiptTotal = checkoutSuccess?.total ?? payableTotal;

    const receiptLines = [
      'GTSoftHub | comprovante da compra',
      `Pedido: ${receiptOrderNo}`,
      `Cliente: ${receiptCustomerName}`,
      `Pagamento: ${getPaymentMethodLabel(receiptPaymentMethod)}`,
      `Recebimento: ${getDeliveryTypeLabel(receiptDeliveryType)}`,
      '',
      'Itens:',
      ...(checkoutSnapshot?.items || []).map(
        (item) =>
          `- ${item.name} | ${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}`,
      ),
      '',
      `Total: ${formatCurrency(receiptTotal)}`,
    ];

    try {
      await navigator.clipboard.writeText(receiptLines.join('\n'));
      toast.success('Comprovante da compra copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o comprovante agora.');
    }
  };

  const handleOpenOrderTracking = () => {
    const orderNo = checkoutSuccess?.orderNo || createdOrder?.orderNo;
    if (!orderNo) {
      toast.error('Codigo do pedido indisponivel para acompanhamento.');
      return;
    }

    saveOrderTrackingContext({
      orderNo,
      customerEmail: checkoutSuccess?.customerEmail || customerInfo.email,
      customerPhone: checkoutSuccess?.customerPhone || customerInfo.phone,
      customerName: checkoutSuccess?.customerName || customerInfo.name,
    });
    router.push(`/pedido?order=${encodeURIComponent(orderNo)}`);
  };

  const handleCreateOrderAndPayment = async () => {
    if (!activeTenantId) {
      toast.error('Tenant ID nao configurado. Revise a integracao da loja.');
      return;
    }

    if (cart.length === 0) {
      toast.error('Carrinho vazio.');
      return;
    }

    if (!validateCustomerData() || !validateCartStock()) {
      return;
    }

    if (paymentMethod === 'dinheiro') {
      if (!Number.isFinite(cashReceivedNumber) || cashReceivedNumber <= 0) {
        toast.error('Informe o valor recebido em dinheiro.');
        return;
      }
      if (cashReceivedNumber < payableTotal) {
        toast.error('Valor recebido menor que o total.');
        return;
      }
    }

    setPaymentLoading(true);
    setPaymentError(null);

    try {
      const phoneDigits = customerInfo.phone.replace(/\D/g, '');
      const snapshotItems = cart.map((item) => ({ ...item }));
      const orderPayload = {
        channel: 'ecommerce',
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: phoneDigits,
        customer_notes: customerInfo.notes?.trim() || undefined,
        delivery_type: customerInfo.deliveryType,
        delivery_address:
          customerInfo.deliveryType === 'delivery'
            ? {
                street: customerInfo.address.street,
                number: customerInfo.address.number,
                complement: customerInfo.address.complement || undefined,
                neighborhood: customerInfo.address.neighborhood,
                city: customerInfo.address.city,
                state: customerInfo.address.state,
                zipcode: customerInfo.address.zipcode,
              }
            : undefined,
        items: cart.map((item) => ({
          produto_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        discount_amount: 0,
        shipping_amount: deliveryFee,
        coupon_code: couponCode ? couponCode.trim().toUpperCase() : undefined,
      };

      let orderContext = createdOrder;
      let orderTotal = createdOrder?.total ?? checkoutTotal;

      if (!orderContext) {
        const idempotencyKey = getCheckoutIdempotencyKey();
        const created = isOperatorPreview
          ? await api.createOrder(orderPayload, activeTenantId, idempotencyKey)
          : await api.createPublicOrder(orderPayload, activeTenantId, idempotencyKey);
        const totalAmount = Number(created.total_amount);
        orderTotal = Number.isFinite(totalAmount) ? totalAmount : checkoutTotal;

        orderContext = {
          id: created.id,
          total: orderTotal,
          orderNo: created.order_no || created.orderNo,
        };

        setCreatedOrder(orderContext);
        setCheckoutSnapshot({
          items: snapshotItems,
          subtotal,
          deliveryFee,
          total: orderTotal,
        });

        if (orderContext.orderNo) {
          saveOrderTrackingContext({
            orderNo: orderContext.orderNo,
            customerEmail: customerInfo.email,
            customerPhone: customerInfo.phone,
            customerName: customerInfo.name,
          });
        }
      } else if (!checkoutSnapshot) {
        setCheckoutSnapshot({
          items: snapshotItems,
          subtotal,
          deliveryFee,
          total: orderContext.total,
        });
      }

      const paymentPayload: {
        pedido_id: string;
        method: PaymentMethod;
        amount: number;
        metadata?: Record<string, unknown>;
      } = {
        pedido_id: orderContext.id,
        method: paymentMethod,
        amount: orderContext.total,
      };

      if (paymentMethod === 'dinheiro' && Number.isFinite(cashReceivedNumber)) {
        paymentPayload.metadata = {
          cash_change_for: cashReceivedNumber,
          cash_change_amount: Math.max(0, cashReceivedNumber - orderContext.total),
        };
      }

      const paymentResult = isOperatorPreview
        ? await api.createPayment(paymentPayload, activeTenantId)
        : await api.createPublicPayment(paymentPayload, activeTenantId);
      setPaymentData(paymentResult);
      setCart([]);
      setShowCart(false);
      toast.success(
        createdOrder ? 'Pagamento gerado novamente para o pedido existente.' : 'Pedido criado e pagamento gerado.',
      );
    } catch (error: any) {
      const message = error?.message || 'Nao foi possivel criar pedido e pagamento';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!activeTenantId || !paymentData?.pagamento?.id) return;
    if (!isOperatorPreview) {
      toast.error(
        'A confirmacao do pagamento nao acontece no navegador do cliente. Use o acompanhamento do pedido enquanto aguardamos a confirmacao automatica.',
      );
      return;
    }

    setPaymentLoading(true);
    setPaymentError(null);

    try {
      await api.confirmPayment(paymentData.pagamento.id, activeTenantId);
      toast.success('Pagamento confirmado.');
      setPaymentData((current) =>
        current
          ? {
              ...current,
              pagamento: {
                ...current.pagamento,
                status: 'confirmed',
              },
            }
          : current,
      );
      setCheckoutSuccess({
        orderNo: createdOrder?.orderNo,
        total: payableTotal,
        paymentMethod,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
        deliveryType: customerInfo.deliveryType,
        changeAmount:
          paymentMethod === 'dinheiro' && Number.isFinite(cashReceivedNumber)
            ? Math.max(0, cashReceivedNumber - payableTotal)
            : undefined,
      });
      if (createdOrder?.orderNo) {
        saveOrderTrackingContext({
          orderNo: createdOrder.orderNo,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone,
          customerName: customerInfo.name,
        });
      }
      setCustomerInfo(initialCustomerInfo);
    } catch (error: any) {
      const message = error?.message || 'Erro ao confirmar pagamento';
      setPaymentError(message);
      toast.error(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    setShowCart(false);
    if (!hasActiveCheckoutSession) {
      resetPaymentState();
    }
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    if (paymentLoading) return;
    if (createdOrder?.orderNo) {
      saveOrderTrackingContext({
        orderNo: createdOrder.orderNo,
        customerEmail: checkoutSuccess?.customerEmail || customerInfo.email,
        customerPhone: checkoutSuccess?.customerPhone || customerInfo.phone,
        customerName: checkoutSuccess?.customerName || customerInfo.name,
      });
    }
    setShowCheckout(false);
    if (!hasActiveCheckoutSession || checkoutSuccess) {
      resetPaymentState();
    }
  };

  const hasTenantConfiguration = !authLoading && !!activeTenantId;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(10, 14, 24, 0.96)',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.15)',
          },
        }}
      />

      <div className="pointer-events-none fixed inset-0 -z-10 bg-background" />
      <div className="pointer-events-none fixed inset-0 -z-10 mesh-gradient opacity-60" />
      <div className="pointer-events-none fixed inset-0 -z-10 dot-pattern opacity-[0.08]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.13),transparent_60%)]" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-35px_rgba(16,185,129,0.9)]">
              <Store className="size-5 text-accent" />
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
                ecommerce conectado
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{STORE_NAME}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pedido"
              className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08] md:inline-flex"
            >
              Acompanhar pedido
            </Link>
            <a
              href="#catalogo"
              className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08] sm:inline-flex"
            >
              Ver catalogo
            </a>
            <button
              type="button"
              onClick={() => {
                if (hasActiveCheckoutSession) {
                  setShowCart(false);
                  setShowCheckout(true);
                  return;
                }

                setShowCart(true);
              }}
              className="relative inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              <ShoppingBag className="size-4" />
              Carrinho
              {cartCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="relative pb-28">
        <section className="px-4 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.04] p-7 shadow-[0_35px_120px_-60px_rgba(2,6,23,0.95)] sm:p-9">
                <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_45%)]" />

                <div className="relative">
                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                    <Sparkles className="size-3.5" />
                    experiencia de compra premium
                  </div>

                  <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                    Venda com uma vitrine que transmite
                    <span className="block text-muted-foreground">clareza, desejo e confianca.</span>
                  </h2>

                  <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                    {STORE_TAGLINE}
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">checkout</p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground">
                        Fluxo simples, com entrega, retirada, Pix e dinheiro.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">estoque</p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground">
                        Disponibilidade clara para reduzir atrito e frustracao.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">percepcao</p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground">
                        Design mais nobre, elegante e pronto para impressionar.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a
                      href="#catalogo"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                    >
                      Explorar catalogo
                      <ArrowRight className="size-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowCart(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                    >
                      Abrir carrinho
                      <ShoppingBag className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[36px] border border-white/10 bg-white/[0.04] p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        sensacao para o cliente
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                        Compra segura, rapida e memoravel.
                      </h3>
                    </div>
                    <div className="hidden size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-accent sm:flex">
                      <ShieldCheck className="size-6" />
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <BadgeCheck className="mt-0.5 size-5 text-accent" />
                      <div>
                        <p className="font-medium text-foreground">Catalogo com leitura de estoque real</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          Menos surpresa, mais transparencia e mais confianca no pedido.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <CreditCard className="mt-0.5 size-5 text-accent" />
                      <div>
                        <p className="font-medium text-foreground">Pagamento com cara de operacao madura</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          Pix, dinheiro e resumo de pedido claro do inicio ao fim.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <Truck className="mt-0.5 size-5 text-accent" />
                      <div>
                        <p className="font-medium text-foreground">Entrega ou retirada sem confusao</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          O cliente entende o fluxo em segundos e finaliza com mais tranquilidade.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <MetricCard
                    icon={<Package2 className="size-5" />}
                    label="produtos"
                    value={`${products.length}`}
                    hint="catalogo pronto para ser explorado"
                  />
                  <MetricCard
                    icon={<Boxes className="size-5" />}
                    label="disponiveis"
                    value={`${catalogStats.readyProducts}`}
                    hint="itens com venda liberada agora"
                  />
                  <MetricCard
                    icon={<ShoppingBag className="size-5" />}
                    label="carrinho"
                    value={`${cartCount}`}
                    hint={
                      cartCount > 0
                        ? 'itens separados para checkout'
                        : 'pronto para receber a primeira compra'
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {hasTenantConfiguration && isOperatorPreview && (
          <section className="px-4 pt-2 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,1)] sm:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    jornada da primeira compra
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    A loja agora guia a compra com mais clareza do primeiro clique ao pagamento.
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                    Esta leitura ajuda o empreendedor a sentir se a vitrine ja esta emocionante,
                    pratica e convincente o suficiente para o cliente seguir adiante sem hesitar.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    progresso percebido
                  </p>
                  <div className="mt-2 flex items-end gap-3">
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {storefrontJourneyProgress}%
                    </p>
                    <p className="pb-1 text-sm text-muted-foreground">
                      {storefrontJourneyDone}/{storefrontJourney.length} momentos ativados
                    </p>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#34d399_0%,#38bdf8_100%)] transition-all"
                      style={{ width: `${Math.max(storefrontJourneyProgress, 8)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {storefrontJourney.map((step) => (
                  <div
                    key={step.key}
                    className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="inline-flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
                        {step.icon}
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em]',
                          step.ready
                            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                            : 'border-white/10 bg-white/[0.05] text-muted-foreground',
                        )}
                      >
                        {step.ready ? 'ativo' : 'proximo'}
                      </span>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      {step.label}
                    </p>
                    <h4 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                      {step.title}
                    </h4>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>

              {cartCount === 0 && products.length > 0 && (
                <div className="mt-6 flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      proximo passo recomendado
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                      Escolha o primeiro item e deixe o checkout fazer o resto.
                    </p>
                  </div>
                  <a
                    href="#catalogo"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    Explorar catalogo
                    <ArrowRight className="size-4" />
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        <section id="catalogo" className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_100px_-70px_rgba(15,23,42,1)] sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      catalogo inteligente
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      Encontre, compare e compre com rapidez.
                    </h3>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar por produto, descricao ou categoria..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className={cn(controlClassName, 'pl-11')}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {sortedProducts.length} resultados
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {catalogStats.categoryCount || 1} colecoes
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {catalogStats.lowStockProducts} com estoque apertado
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      ordenar por
                    </label>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                      className={cn(controlClassName, 'mt-3')}
                    >
                      <option value="relevancia">Relevancia</option>
                      <option value="preco_asc">Menor preco</option>
                      <option value="preco_desc">Maior preco</option>
                      <option value="disponibilidade">Mais disponiveis</option>
                    </select>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      recebimento
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCustomerInfo({ ...customerInfo, deliveryType: 'delivery' })
                        }
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-left text-sm transition',
                          customerInfo.deliveryType === 'delivery'
                            ? 'border-accent/30 bg-accent/10 text-foreground'
                            : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="size-4" />
                          Entrega
                        </div>
                        <p className="mt-1 text-xs opacity-80">{formatCurrency(DELIVERY_FEE)}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerInfo({ ...customerInfo, deliveryType: 'pickup' })}
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-left text-sm transition',
                          customerInfo.deliveryType === 'pickup'
                            ? 'border-accent/30 bg-accent/10 text-foreground'
                            : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4" />
                          Retirada
                        </div>
                        <p className="mt-1 text-xs opacity-80">Sem taxa</p>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSortBy('relevancia');
                      }}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {!hasTenantConfiguration ? (
              <div className="rounded-[32px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(251,191,36,0.12)_0%,rgba(245,158,11,0.08)_42%,rgba(15,23,42,0.88)_100%)] p-6 sm:p-8">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-100/70">
                  {isOperatorPreview ? 'configuracao necessaria' : 'vitrine em preparacao'}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-amber-50">
                  {isOperatorPreview
                    ? 'A loja precisa de um tenant configurado para carregar o catalogo.'
                    : 'Estamos preparando esta vitrine para abrir com tudo no lugar.'}
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-amber-50/75">
                  {isOperatorPreview
                    ? 'Defina `NEXT_PUBLIC_TENANT_ID` ou use um token com tenant valido no login para conectar esta vitrine ao ambiente certo.'
                    : 'Volte em instantes. Assim que a curadoria terminar, o catalogo aparecera aqui com a experiencia completa de compra.'}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-amber-200/15 bg-black/10 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">tenant</p>
                    <p className="mt-2 text-sm font-medium text-amber-50">
                      {isOperatorPreview
                        ? 'Conecta a vitrine ao catalogo correto.'
                        : 'A abertura acontece quando o catalogo estiver certo.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/15 bg-black/10 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">login</p>
                    <p className="mt-2 text-sm font-medium text-amber-50">
                      {isOperatorPreview
                        ? 'Um token valido tambem libera o tenant automaticamente.'
                        : 'A experiencia final vai surgir aqui sem friccao.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/15 bg-black/10 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">resultado</p>
                    <p className="mt-2 text-sm font-medium text-amber-50">
                      {isOperatorPreview
                        ? 'Catalogo, checkout e pagamento passam a refletir a operacao real.'
                        : 'Catalogo, checkout e pagamento vao nascer aqui de forma integrada.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6"
                  >
                    <div className="h-32 animate-pulse rounded-[24px] bg-white/[0.06]" />
                    <div className="mt-6 h-6 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/[0.05]" />
                    <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-white/[0.05]" />
                    <div className="mt-6 h-12 animate-pulse rounded-2xl bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            ) : sortedProducts.length === 0 && products.length === 0 ? (
              <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12)_0%,rgba(56,189,248,0.08)_36%,rgba(15,23,42,0.9)_100%)] px-6 py-12 sm:px-8">
                <div className="mx-auto max-w-3xl text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-accent">
                    <Compass className="size-6" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                    {isOperatorPreview
                      ? 'Esta vitrine premium esta em curadoria final.'
                      : 'Estamos selecionando os primeiros destaques desta vitrine.'}
                  </h3>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    {isOperatorPreview
                      ? 'Assim que os primeiros produtos forem publicados, a experiencia inteira ja estara pronta para transmitir confianca, desejo e clareza na compra.'
                      : 'Volte em instantes. Assim que os primeiros produtos entrarem no ar, a compra inteira ja vai nascer com mais clareza e confianca.'}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">design</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        A vitrine ja esta preparada para receber o mix principal.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">checkout</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Pagamento, entrega e retirada ja estao prontos para operar.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">proximo passo</p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {isOperatorPreview
                          ? 'Publique o primeiro produto e recarregue para ver a vitrine nascer.'
                          : 'A vitrine vai abrir assim que a curadoria final for concluida.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="rounded-[32px] border border-white/10 bg-white/[0.04] px-6 py-12 text-center sm:px-8">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-accent">
                  <Search className="size-6" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                  Nenhum produto encontrado para este filtro.
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Limpe a busca, mude a ordenacao ou volte para o catalogo completo em um clique.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSortBy('relevancia');
                  }}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                >
                  Limpar filtros
                  <CheckCircle2 className="size-4" />
                </button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sortedProducts.map((product, index) => {
                  const availableStock = getAvailableUnits(product);
                  const stockTone = getStockTone(availableStock, product.min_stock ?? 0);
                  const palette = getProductPalette(index);
                  const quantityInCart = cartQuantityById.get(product.id) || 0;

                  return (
                    <article
                      key={product.id}
                      className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-card/70 transition duration-300 hover:-translate-y-1 hover:border-white/15"
                    >
                      <div
                        className={cn(
                          'pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-br opacity-90',
                          palette.gradient,
                        )}
                      />

                      <div className="relative flex h-full flex-col p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={cn(
                              'flex size-14 items-center justify-center rounded-[22px] border text-lg font-semibold uppercase tracking-[0.12em]',
                              palette.accent,
                              palette.glow,
                            )}
                          >
                            {product.name.slice(0, 2)}
                          </div>
                          <div
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.16em]',
                              stockTone.className,
                            )}
                          >
                            {stockTone.label}
                          </div>
                        </div>

                        <div className="mt-6 flex-1">
                          {product.categoria?.name && (
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              {product.categoria.name}
                            </p>
                          )}
                          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                            {product.name}
                          </h3>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {product.description ||
                              'Produto integrado ao estoque unico, pronto para uma experiencia de compra mais confiavel.'}
                          </p>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                  preco
                                </p>
                                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                                  {formatCurrency(parseFloat(product.price))}
                                </p>
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <p>{stockTone.detail}</p>
                                {!!product.reserved_stock && (
                                  <p className="mt-1">{product.reserved_stock} reservado agora</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                              {quantityInCart > 0
                                ? `${quantityInCart} no carrinho`
                                : 'Pronto para comprar'}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddToCart(product)}
                              disabled={availableStock <= 0}
                              className={cn(
                                'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                                availableStock <= 0
                                  ? 'cursor-not-allowed border border-white/10 bg-white/[0.03] text-muted-foreground'
                                  : 'bg-foreground text-background hover:opacity-90',
                              )}
                            >
                              <Plus className="size-4" />
                              {availableStock <= 0 ? 'Indisponivel' : 'Adicionar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-4 right-4 z-20 flex items-center justify-between rounded-[28px] border border-white/10 bg-background/95 px-5 py-4 shadow-[0_25px_80px_-50px_rgba(15,23,42,0.95)] backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[24rem]"
        >
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">carrinho ativo</p>
            <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
              {cartCount} item{cartCount > 1 ? 's' : ''} • {formatCurrency(checkoutTotal)}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background">
            Abrir
            <ArrowRight className="size-4" />
          </div>
        </button>
      )}

      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent className="overflow-hidden border-white/10 bg-[rgba(5,8,22,0.97)] p-0 text-foreground sm:max-w-xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-white/10 px-6 py-6">
              <div className="flex items-start justify-between gap-4 pr-10">
                <div>
                  <SheetTitle className="text-2xl tracking-tight text-foreground">
                    Seu carrinho
                  </SheetTitle>
                  <SheetDescription className="mt-2">
                    Revise os itens e siga para um checkout mais claro e confiavel.
                  </SheetDescription>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {cartCount} item{cartCount === 1 ? '' : 's'}
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {cart.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.08)_0%,rgba(56,189,248,0.06)_38%,rgba(255,255,255,0.03)_100%)] p-6">
                  <div className="text-center">
                    <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                      Carrinho vazio
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Adicione o primeiro produto e veja como o checkout assume o resto com mais elegancia.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        entrega ou retirada
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        O cliente entende o caminho do pedido sem friccao.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        pagamento claro
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Pix e dinheiro aparecem com resumo, valor e confirmacao mais limpos.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        estoque confiavel
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        A disponibilidade visivel evita surpresa e protege a percepcao da marca.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCart(false);
                      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    Explorar catalogo
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-foreground">
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatCurrency(item.price)} por unidade
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.id, 0)}
                          className="rounded-full border border-white/10 p-2 text-muted-foreground transition hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-100"
                          aria-label={`Remover ${item.name} do carrinho`}
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            className="rounded-xl p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                            aria-label={`Diminuir quantidade de ${item.name}`}
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="min-w-10 px-2 text-center text-sm font-semibold text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            className="rounded-xl p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                            aria-label={`Aumentar quantidade de ${item.name}`}
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>

                        <p className="text-lg font-semibold tracking-tight text-foreground">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-6 py-6">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-5 space-y-3">
                  <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                  <SummaryRow
                    label={customerInfo.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
                    value={
                      customerInfo.deliveryType === 'delivery'
                        ? formatCurrency(deliveryFee)
                        : 'Sem taxa'
                    }
                  />
                  <SummaryRow label="Total" value={formatCurrency(checkoutTotal)} strong />
                </div>

                <button
                  type="button"
                  onClick={openCheckout}
                  disabled={cart.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Finalizar compra
                  <ArrowRight className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={handleClearCart}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                >
                  Limpar carrinho
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={showCheckout}
        onOpenChange={(open) => {
          if (!open) {
            closeCheckout();
            return;
          }

          setShowCheckout(true);
        }}
      >
        <DialogContent
          showCloseButton={!paymentLoading}
          className="max-h-[92vh] max-w-6xl overflow-hidden border-white/10 bg-[rgba(5,8,22,0.98)] p-0 text-foreground shadow-[0_40px_140px_-60px_rgba(2,6,23,1)]"
        >
          {checkoutSuccess ? (
            <div className="grid h-full lg:grid-cols-[1.08fr_0.92fr]">
              <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(160deg,rgba(16,185,129,0.2)_0%,rgba(56,189,248,0.14)_42%,rgba(5,8,22,0.98)_100%)] px-6 py-8 sm:px-8 sm:py-9 lg:border-b-0 lg:border-r">
                <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.18),transparent_38%)]" />
                <div className="relative">
                  <div className="inline-flex size-14 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                    <BadgeCheck className="size-7" />
                  </div>
                  <p className="mt-6 text-xs uppercase tracking-[0.28em] text-emerald-100/75">
                    pagamento confirmado
                  </p>
                  <h3 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white">
                    {checkoutSuccess.customerName
                      ? `${checkoutSuccess.customerName.split(' ')[0]}, seu pedido agora esta oficialmente a caminho.`
                      : 'Seu pedido agora esta oficialmente a caminho.'}
                  </h3>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200/85">
                    A experiencia fechou com o mesmo cuidado do resto da jornada: clareza no total,
                    confianca no pagamento e um proximo passo obvio para o cliente.
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-300">pedido</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {checkoutSuccess.orderNo || 'Pedido confirmado'}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-300">total</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {formatCurrency(checkoutSuccess.total)}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-300">recebimento</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {getDeliveryTypeLabel(checkoutSuccess.deliveryType)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between bg-white/[0.03] px-6 py-8 sm:px-8 sm:py-9">
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      proximo capitulo
                    </p>
                    <h4 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      O cliente sai com mais serenidade e mais vontade de voltar.
                    </h4>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="space-y-3">
                      <SummaryRow
                        label="Metodo"
                        value={getPaymentMethodLabel(checkoutSuccess.paymentMethod)}
                      />
                      <SummaryRow
                        label="Recebimento"
                        value={getDeliveryTypeLabel(checkoutSuccess.deliveryType)}
                      />
                      {typeof checkoutSuccess.changeAmount === 'number' && (
                        <SummaryRow
                          label="Troco previsto"
                          value={formatCurrency(checkoutSuccess.changeAmount)}
                        />
                      )}
                      <SummaryRow label="Total confirmado" value={formatCurrency(checkoutSuccess.total)} strong />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        confianca
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        O pedido ficou claro do carrinho ate a confirmacao final.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        retorno
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Agora a vitrine esta pronta para a proxima compra com o mesmo padrao premium.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-background/60 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      acompanhamento
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">
                          etapa 1
                        </p>
                        <p className="mt-2 text-sm font-medium text-emerald-50">
                          Pagamento confirmado e pedido registrado com o codigo {checkoutSuccess.orderNo || 'da compra'}.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          etapa 2
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          A preparacao e a retirada ou entrega aparecem na pagina de acompanhamento em tempo real.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  {checkoutSuccess.orderNo && (
                    <button
                      type="button"
                      onClick={handleOpenOrderTracking}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
                    >
                      Acompanhar pedido agora
                      <ArrowRight className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCopyCheckoutReceipt()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                  >
                    <Copy className="size-4" />
                    Copiar comprovante
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeCheckout();
                      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    Continuar comprando
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={closeCheckout}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                  >
                    Fechar resumo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateOrderAndPayment();
              }}
              className="grid h-full lg:grid-cols-[1.08fr_0.92fr]"
            >
            <div className="max-h-[92vh] overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              <DialogHeader className="mb-6 text-left">
                <DialogTitle className="text-3xl tracking-tight text-foreground">
                  Checkout premium
                </DialogTitle>
                <DialogDescription className="max-w-2xl leading-relaxed">
                  Um fluxo mais elegante para inspirar confianca do carrinho ate a confirmacao do
                  pagamento.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    dados do cliente
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Nome completo *
                      </label>
                      <input
                        type="text"
                        value={customerInfo.name}
                        onChange={(event) =>
                          setCustomerInfo({ ...customerInfo, name: event.target.value })
                        }
                        required
                        className={controlClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={customerInfo.email}
                        onChange={(event) =>
                          setCustomerInfo({ ...customerInfo, email: event.target.value })
                        }
                        required
                        className={controlClassName}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Telefone *
                      </label>
                      <input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(event) =>
                          setCustomerInfo({ ...customerInfo, phone: event.target.value })
                        }
                        required
                        className={controlClassName}
                        placeholder="DDD + numero"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    recebimento
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCustomerInfo({ ...customerInfo, deliveryType: 'delivery' })
                      }
                      className={cn(
                        'rounded-[24px] border p-4 text-left transition',
                        customerInfo.deliveryType === 'delivery'
                          ? 'border-accent/30 bg-accent/10'
                          : 'border-white/10 bg-white/[0.04]',
                      )}
                    >
                      <div className="flex items-center gap-2 text-foreground">
                        <Truck className="size-4" />
                        <span className="font-medium">Entrega</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Taxa atual: {formatCurrency(DELIVERY_FEE)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerInfo({ ...customerInfo, deliveryType: 'pickup' })}
                      className={cn(
                        'rounded-[24px] border p-4 text-left transition',
                        customerInfo.deliveryType === 'pickup'
                          ? 'border-accent/30 bg-accent/10'
                          : 'border-white/10 bg-white/[0.04]',
                      )}
                    >
                      <div className="flex items-center gap-2 text-foreground">
                        <MapPin className="size-4" />
                        <span className="font-medium">Retirada</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Sem taxa adicional</p>
                    </button>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Observacoes
                    </label>
                    <textarea
                      value={customerInfo.notes}
                      onChange={(event) =>
                        setCustomerInfo({ ...customerInfo, notes: event.target.value })
                      }
                      rows={3}
                      className={controlClassName}
                      placeholder="Algo importante para a equipe saber?"
                    />
                  </div>
                </section>

                {customerInfo.deliveryType === 'delivery' && (
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      endereco de entrega
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Rua *
                        </label>
                        <input
                          type="text"
                          value={customerInfo.address.street}
                          onChange={(event) =>
                            setCustomerInfo({
                              ...customerInfo,
                              address: { ...customerInfo.address, street: event.target.value },
                            })
                          }
                          required
                          className={controlClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Numero *
                        </label>
                        <input
                          type="text"
                          value={customerInfo.address.number}
                          onChange={(event) =>
                            setCustomerInfo({
                              ...customerInfo,
                              address: { ...customerInfo.address, number: event.target.value },
                            })
                          }
                          required
                          className={controlClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Bairro *
                        </label>
                        <input
                          type="text"
                          value={customerInfo.address.neighborhood}
                          onChange={(event) =>
                            setCustomerInfo({
                              ...customerInfo,
                              address: {
                                ...customerInfo.address,
                                neighborhood: event.target.value,
                              },
                            })
                          }
                          required
                          className={controlClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Complemento
                        </label>
                        <input
                          type="text"
                          value={customerInfo.address.complement}
                          onChange={(event) =>
                            setCustomerInfo({
                              ...customerInfo,
                              address: {
                                ...customerInfo.address,
                                complement: event.target.value,
                              },
                            })
                          }
                          className={controlClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Cidade *
                        </label>
                        <input
                          type="text"
                          value={customerInfo.address.city}
                          onChange={(event) =>
                            setCustomerInfo({
                              ...customerInfo,
                              address: { ...customerInfo.address, city: event.target.value },
                            })
                          }
                          required
                          className={controlClassName}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground">
                            UF *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.address.state}
                            onChange={(event) =>
                              setCustomerInfo({
                                ...customerInfo,
                                address: {
                                  ...customerInfo.address,
                                  state: event.target.value
                                    .toUpperCase()
                                    .replace(/[^A-Z]/g, '')
                                    .slice(0, 2),
                                },
                              })
                            }
                            required
                            maxLength={2}
                            className={controlClassName}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground">
                            CEP *
                          </label>
                          <input
                            type="text"
                            value={customerInfo.address.zipcode}
                            onChange={(event) =>
                              setCustomerInfo({
                                ...customerInfo,
                                address: {
                                  ...customerInfo.address,
                                  zipcode: event.target.value.replace(/\D/g, '').slice(0, 8),
                                },
                              })
                            }
                            required
                            className={controlClassName}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    pagamento
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={cn(
                        'rounded-[24px] border p-4 text-left transition',
                        paymentMethod === 'pix'
                          ? 'border-accent/30 bg-accent/10'
                          : 'border-white/10 bg-white/[0.04]',
                      )}
                    >
                      <div className="flex items-center gap-2 text-foreground">
                        <CreditCard className="size-4" />
                        <span className="font-medium">Pix</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        QR code e copia e cola para pagamento imediato.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('dinheiro')}
                      className={cn(
                        'rounded-[24px] border p-4 text-left transition',
                        paymentMethod === 'dinheiro'
                          ? 'border-accent/30 bg-accent/10'
                          : 'border-white/10 bg-white/[0.04]',
                      )}
                    >
                      <div className="flex items-center gap-2 text-foreground">
                        <Banknote className="size-4" />
                        <span className="font-medium">Dinheiro</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Informe o valor recebido e veja o troco previsto.
                      </p>
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Cupom
                      </label>
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value)}
                        placeholder="PROMO10"
                        disabled={Boolean(createdOrder)}
                        className={controlClassName}
                      />
                      {createdOrder && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          O cupom fica travado depois que o pedido ja foi criado para evitar divergencia no pagamento.
                        </p>
                      )}
                    </div>

                    {paymentMethod === 'dinheiro' && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Valor recebido
                        </label>
                        <input
                          type="text"
                          value={cashReceived}
                          onChange={(event) => setCashReceived(event.target.value)}
                          placeholder="0,00"
                          className={controlClassName}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          Troco previsto: {formatCurrency(cashChange)}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <aside className="border-t border-white/10 bg-white/[0.03] px-6 py-6 sm:px-8 sm:py-8 lg:border-t-0 lg:border-l">
              <div className="flex h-full flex-col">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    resumo do pedido
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    Tudo claro antes de confirmar.
                  </h3>
                  {createdOrder?.orderNo && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Pedido {createdOrder.orderNo}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
                  {summaryItems.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
                      <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                        Adicione produtos no carrinho para abrir o checkout.
                      </p>
                    </div>
                  ) : (
                    summaryItems.map((item) => (
                      <div
                        key={`${item.id}-${item.quantity}`}
                        className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-foreground">{item.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.quantity} x {formatCurrency(item.price)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 rounded-[28px] border border-white/10 bg-background/60 p-5">
                  <div className="space-y-3">
                    <SummaryRow label="Subtotal" value={formatCurrency(summarySubtotal)} />
                    <SummaryRow
                      label={customerInfo.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
                      value={
                        customerInfo.deliveryType === 'delivery'
                          ? formatCurrency(summaryDeliveryFee)
                          : 'Sem taxa'
                      }
                    />
                    <SummaryRow label="Total" value={formatCurrency(summaryTotal)} strong />
                  </div>

                  {paymentError && (
                    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                      {paymentError}
                    </div>
                  )}

                  {!paymentData ? (
                    <button
                      type="submit"
                      disabled={paymentLoading || summaryItems.length === 0}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {paymentLoading
                        ? 'Processando...'
                        : createdOrder
                          ? 'Gerar pagamento novamente'
                          : 'Criar pedido e gerar pagamento'}
                      <ArrowRight className="size-4" />
                    </button>
                  ) : (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm text-muted-foreground">Status do pagamento</p>
                        <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                          {getPaymentStatusLabel(paymentData.pagamento.status)}
                        </p>
                        {paymentData.message && (
                          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                            {paymentData.message}
                          </p>
                        )}
                      </div>

                      {createdOrder?.orderNo && (
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-sm text-muted-foreground">Codigo do pedido</p>
                          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                            {createdOrder.orderNo}
                          </p>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            O acompanhamento do pedido ja esta pronto mesmo antes da confirmacao final do pagamento.
                          </p>
                        </div>
                      )}

                      {paymentMethod === 'pix' &&
                        (paymentData.qr_code || paymentData.qr_code_url) && (
                          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex justify-center">
                              <Image
                                src={paymentData.qr_code || paymentData.qr_code_url || ''}
                                alt="QR Code Pix"
                                width={208}
                                height={208}
                                unoptimized
                                className="h-52 w-52 rounded-2xl border border-white/10 bg-white object-contain p-3"
                              />
                            </div>

                            {paymentData.copy_paste && (
                              <div className="mt-4">
                                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                  copia e cola
                                </label>
                                <textarea
                                  readOnly
                                  value={paymentData.copy_paste}
                                  rows={4}
                                  className={cn(controlClassName, 'text-xs leading-relaxed')}
                                />
                                <button
                                  type="button"
                                  onClick={handleCopyPixCode}
                                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                                >
                                  <Copy className="size-4" />
                                  Copiar codigo Pix
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      <div className="space-y-3">
                        {createdOrder?.orderNo && (
                          <button
                            type="button"
                            onClick={handleOpenOrderTracking}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                          >
                            Acompanhar pedido
                            <ArrowRight className="size-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleCopyCheckoutReceipt()}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                        >
                          <Copy className="size-4" />
                          Copiar comprovante
                        </button>
                        {isOperatorPreview ? (
                          <button
                            type="button"
                            onClick={handleConfirmPayment}
                            disabled={paymentLoading}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {paymentLoading ? 'Confirmando...' : 'Confirmar pagamento'}
                            <BadgeCheck className="size-4" />
                          </button>
                        ) : (
                          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-4 text-sm leading-relaxed text-emerald-50">
                            {paymentMethod === 'pix'
                              ? 'Assim que o Pix for pago, a confirmacao aparecera automaticamente no acompanhamento do pedido.'
                              : 'Seu pedido foi enviado para a loja. A confirmacao do dinheiro acontece na retirada ou na entrega.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
