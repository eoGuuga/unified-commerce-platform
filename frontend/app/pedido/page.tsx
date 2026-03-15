'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Toaster, toast } from 'react-hot-toast';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Copy,
  LoaderCircle,
  MapPin,
  PackageCheck,
  Package2,
  Phone,
  RefreshCcw,
  ScanQrCode,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import api from '@/lib/api-client';
import { readOrderTrackingContext, saveOrderTrackingContext } from '@/lib/order-tracking';
import { cn } from '@/lib/utils';

type OrderStatus =
  | 'pendente_pagamento'
  | 'confirmado'
  | 'em_producao'
  | 'pronto'
  | 'em_transito'
  | 'entregue'
  | 'cancelado';

type PaymentMethod = 'pix' | 'dinheiro' | 'credito' | 'debito' | 'boleto';
type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';

interface TrackedOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface TrackedOrderPayment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  qr_code?: string;
  qr_code_url?: string;
  copy_paste?: string;
}

interface TrackedOrder {
  id: string;
  order_no: string;
  status: OrderStatus;
  channel: 'pdv' | 'ecommerce' | 'whatsapp';
  customer_name?: string;
  customer_email_masked?: string;
  customer_phone_masked?: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  coupon_code?: string;
  delivery_type?: 'delivery' | 'pickup' | string;
  delivery_address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipcode: string;
  };
  created_at: string;
  updated_at: string;
  items: TrackedOrderItem[];
  payment?: TrackedOrderPayment;
}

const controlClassName =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/10';

const statusFlow: Array<{
  key: Exclude<OrderStatus, 'cancelado'>;
  title: string;
  description: string;
}> = [
  {
    key: 'pendente_pagamento',
    title: 'Pagamento em validacao',
    description: 'A compra foi recebida e estamos validando a confirmacao do pagamento.',
  },
  {
    key: 'confirmado',
    title: 'Pedido confirmado',
    description: 'Pagamento confirmado e operacao pronta para avancar.',
  },
  {
    key: 'em_producao',
    title: 'Em preparacao',
    description: 'A equipe esta separando ou produzindo o pedido com prioridade.',
  },
  {
    key: 'pronto',
    title: 'Pronto para sair',
    description: 'Tudo concluido para retirada ou expedicao.',
  },
  {
    key: 'em_transito',
    title: 'Em rota',
    description: 'O pedido ja saiu e segue para entrega.',
  },
  {
    key: 'entregue',
    title: 'Entregue',
    description: 'Pedido concluido com sucesso.',
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function getOrderStatusMeta(status: OrderStatus) {
  const meta: Record<
    OrderStatus,
    {
      label: string;
      title: string;
      description: string;
      pill: string;
      panel: string;
    }
  > = {
    pendente_pagamento: {
      label: 'Pagamento pendente',
      title: 'Seu pedido ja entrou na jornada certa.',
      description: 'Assim que o pagamento for reconhecido, a atualizacao aparece aqui sem friccao.',
      pill: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
      panel: 'border-amber-300/20 bg-amber-300/10',
    },
    confirmado: {
      label: 'Confirmado',
      title: 'Pagamento confirmado e pedido em curso.',
      description: 'A compra esta segura e a operacao ja pode seguir para preparacao.',
      pill: 'border-sky-300/20 bg-sky-300/10 text-sky-100',
      panel: 'border-sky-300/20 bg-sky-300/10',
    },
    em_producao: {
      label: 'Em preparacao',
      title: 'A equipe ja esta cuidando do seu pedido.',
      description: 'Separacao, producao ou montagem em andamento com o mesmo padrao da compra.',
      pill: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
      panel: 'border-cyan-300/20 bg-cyan-300/10',
    },
    pronto: {
      label: 'Pronto',
      title: 'Tudo pronto para retirada ou envio.',
      description: 'Seu pedido concluiu a preparacao e aguarda o ultimo movimento.',
      pill: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
      panel: 'border-emerald-300/20 bg-emerald-300/10',
    },
    em_transito: {
      label: 'Em transito',
      title: 'Seu pedido ja esta a caminho.',
      description: 'A ultima etapa da experiencia esta em movimento.',
      pill: 'border-violet-300/20 bg-violet-300/10 text-violet-100',
      panel: 'border-violet-300/20 bg-violet-300/10',
    },
    entregue: {
      label: 'Entregue',
      title: 'Pedido concluido com sucesso.',
      description: 'A jornada se fechou com clareza e confianca do inicio ao fim.',
      pill: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
      panel: 'border-emerald-300/20 bg-emerald-300/10',
    },
    cancelado: {
      label: 'Cancelado',
      title: 'Este pedido foi encerrado.',
      description: 'Se precisar de apoio para retomar a compra, nosso time pode ajudar.',
      pill: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
      panel: 'border-rose-300/20 bg-rose-300/10',
    },
  };

  return meta[status];
}

function getPaymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    credito: 'Cartao de credito',
    debito: 'Cartao de debito',
    boleto: 'Boleto',
  };

  return labels[method] || method;
}

function getPaymentStatusLabel(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    pending: 'Aguardando pagamento',
    processing: 'Processando',
    paid: 'Pago',
    failed: 'Falhou',
    refunded: 'Reembolsado',
  };

  return labels[status] || status;
}

function getPaymentStatusTone(status: PaymentStatus) {
  const tones: Record<PaymentStatus, string> = {
    pending: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    processing: 'border-sky-300/20 bg-sky-300/10 text-sky-100',
    paid: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    failed: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    refunded: 'border-white/10 bg-white/[0.05] text-foreground',
  };

  return tones[status] || 'border-white/10 bg-white/[0.05] text-foreground';
}

function getDeliveryTypeLabel(deliveryType?: string) {
  return deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
}

function getChannelLabel(channel: TrackedOrder['channel']) {
  const labels: Record<TrackedOrder['channel'], string> = {
    ecommerce: 'Loja online',
    pdv: 'PDV',
    whatsapp: 'WhatsApp',
  };

  return labels[channel] || channel;
}

function buildTrackingUrl(orderNo: string) {
  const path = `/pedido?order=${encodeURIComponent(orderNo)}`;
  if (typeof window === 'undefined') {
    return path;
  }

  return `${window.location.origin}${path}`;
}

function getNextMilestone(order: TrackedOrder) {
  switch (order.status) {
    case 'pendente_pagamento':
      return {
        title: order.payment?.method === 'pix' ? 'Retomar o Pix e concluir o pagamento.' : 'Aguardar a confirmacao do pagamento.',
        description:
          'Assim que o valor for reconhecido, a preparacao aparece aqui sem necessidade de falar com o atendimento.',
      };
    case 'confirmado':
      return {
        title:
          order.delivery_type === 'pickup'
            ? 'A equipe avanca para deixar a retirada pronta.'
            : 'A operacao avanca para separacao e preparacao do envio.',
        description:
          'O pedido ja esta seguro. A proxima leitura relevante sera quando ele entrar em preparacao.',
      };
    case 'em_producao':
      return {
        title:
          order.delivery_type === 'pickup'
            ? 'Assim que estiver pronto, a retirada sera liberada.'
            : 'Assim que a separacao terminar, o pedido muda para pronto.',
        description:
          'Esta e a fase em que a equipe confere itens, acabamento e disponibilidade para o ultimo movimento.',
      };
    case 'pronto':
      return {
        title:
          order.delivery_type === 'pickup'
            ? 'Retirada pronta para acontecer com o codigo em maos.'
            : 'Expedicao prestes a acontecer para sair em rota.',
        description:
          order.delivery_type === 'pickup'
            ? 'Ao chegar, basta informar o codigo do pedido para uma entrega mais rapida e segura.'
            : 'A proxima atualizacao sera a saida para entrega, ja com a leitura em transito neste painel.',
      };
    case 'em_transito':
      return {
        title: 'Entrega em andamento ate a confirmacao final.',
        description:
          'O pedido ja deixou a base e a proxima atualizacao esperada e a conclusao da entrega.',
      };
    case 'entregue':
      return {
        title: 'Jornada concluida com tudo registrado.',
        description:
          'Este acompanhamento continua servindo como comprovante elegante da compra e do recebimento.',
      };
    case 'cancelado':
      return {
        title: 'Fluxo encerrado.',
        description:
          'Se precisar retomar a compra, vale usar o codigo do pedido como referencia para o time.',
      };
  }
}

function buildJourneyMoments(order: TrackedOrder) {
  const nextMilestone = getNextMilestone(order);

  return [
    {
      eyebrow: 'compra recebida',
      title: formatDate(order.created_at),
      description: `Pedido ${order.order_no} entrou pela jornada de ${getChannelLabel(order.channel).toLowerCase()}.`,
    },
    {
      eyebrow: 'ultima leitura',
      title: getOrderStatusMeta(order.status).label,
      description: `Ultima atualizacao registrada em ${formatDate(order.updated_at)} para manter o cliente sempre orientado.`,
    },
    {
      eyebrow: 'proximo movimento',
      title: nextMilestone.title,
      description: nextMilestone.description,
    },
  ];
}

function getFulfillmentGuidance(order: TrackedOrder) {
  switch (order.status) {
    case 'pendente_pagamento':
      return {
        eyebrow: 'o que destrava a operacao',
        title: 'O pagamento e a chave para liberar os proximos passos.',
        description:
          order.payment?.method === 'pix'
            ? 'Se voce parar no meio do checkout, este painel guarda o mesmo QR code e o mesmo copia e cola para retomar com seguranca.'
            : 'Quando o pagamento for confirmado, o pedido segue automaticamente para a preparacao sem exigir nova acao do cliente.',
        bullets: [
          'Use o email ou telefone da compra para voltar aqui quando quiser.',
          'O status muda sozinho assim que a confirmacao do pagamento entra.',
          'O codigo do pedido continua servindo como referencia principal.',
        ],
      };
    case 'confirmado':
    case 'em_producao':
      return {
        eyebrow: order.delivery_type === 'delivery' ? 'preparando a entrega' : 'preparando a retirada',
        title:
          order.delivery_type === 'delivery'
            ? 'Agora a equipe organiza o pedido para sair com clareza e controle.'
            : 'Agora a equipe organiza o pedido para uma retirada fluida e segura.',
        description:
          order.delivery_type === 'delivery'
            ? 'Quando tudo estiver conferido, esta tela avanca para pronto e depois para em transito.'
            : 'Quando tudo estiver conferido, esta tela avanca para pronto para indicar que a retirada pode acontecer.',
        bullets:
          order.delivery_type === 'delivery'
            ? [
                'Endereco e frete ja ficaram vinculados a esta compra.',
                'A saida para rota aparece aqui sem precisar falar com a equipe.',
                'O acompanhamento continua valido ate a conclusao da entrega.',
              ]
            : [
                'Tenha o codigo do pedido em maos para agilizar a retirada.',
                'Assim que o status mudar para pronto, o pedido ja podera ser retirado.',
                'O acompanhamento fica salvo para reabrir quantas vezes quiser.',
              ],
      };
    case 'pronto':
      return {
        eyebrow: order.delivery_type === 'delivery' ? 'pedido pronto para sair' : 'pedido pronto para retirada',
        title:
          order.delivery_type === 'delivery'
            ? 'Seu pedido concluiu a preparacao e aguarda o ultimo movimento.'
            : 'Seu pedido ja pode ser retirado com mais rapidez e seguranca.',
        description:
          order.delivery_type === 'delivery'
            ? 'A expedicao vem a seguir. Este painel continua sendo a referencia para ver quando a rota comecar.'
            : 'Ao chegar, apresente o codigo do pedido. Isso ajuda a equipe a localizar tudo sem friccao.',
        bullets:
          order.delivery_type === 'delivery'
            ? [
                'Itens ja passaram pela etapa principal de conferencia.',
                'A proxima mudanca esperada e a saida para entrega.',
                'O resumo desta compra pode ser compartilhado com quem vai receber.',
              ]
            : [
                'O codigo do pedido e o atalho mais rapido no balcao.',
                'Este acompanhamento serve como comprovante da retirada.',
                'Voce pode compartilhar o link com quem for buscar o pedido.',
              ],
      };
    case 'em_transito':
      return {
        eyebrow: 'ultima milha',
        title: 'O pedido ja esta em rota e a jornada esta quase fechada.',
        description:
          'Esta e a etapa final da operacao. Assim que a entrega for concluida, o status sera atualizado aqui.',
        bullets: [
          'O resumo desta compra continua disponivel para consulta.',
          'O codigo do pedido permanece como referencia de apoio.',
          'A tela segue pronta para compartilhar o andamento com quem precisar.',
        ],
      };
    case 'entregue':
      return {
        eyebrow: 'compra concluida',
        title: 'Tudo entregue e registrado com o mesmo cuidado do checkout.',
        description:
          'Agora esta pagina funciona como um comprovante elegante de fechamento da compra e do recebimento.',
        bullets: [
          'Voce ainda pode copiar o comprovante sempre que quiser.',
          'O link de acompanhamento continua util para registro interno.',
          'O pedido fica facil de localizar se precisar de suporte depois.',
        ],
      };
    case 'cancelado':
      return {
        eyebrow: 'pedido encerrado',
        title: 'Este fluxo foi interrompido e ficou registrado com clareza.',
        description:
          'Se voce precisar retomar a compra, o codigo e o resumo abaixo ajudam a equipe a continuar sem retrabalho.',
        bullets: [
          'Guarde o codigo do pedido para futuras referencias.',
          'O comprovante copiado ajuda a contextualizar a compra.',
          'O time pode orientar o melhor proximo passo se necessario.',
        ],
      };
  }
}

function buildReceiptText(order: TrackedOrder, trackingUrl?: string) {
  const lines = [
    'GTSoftHub | acompanhamento do pedido',
    `Pedido: ${order.order_no}`,
    `Canal: ${getChannelLabel(order.channel)}`,
    `Status: ${getOrderStatusMeta(order.status).label}`,
    `Criado em: ${formatDate(order.created_at)}`,
    `Atualizado em: ${formatDate(order.updated_at)}`,
    `Pagamento: ${
      order.payment
        ? `${getPaymentMethodLabel(order.payment.method)} | ${getPaymentStatusLabel(order.payment.status)}`
        : 'Nao identificado'
    }`,
    `Recebimento: ${getDeliveryTypeLabel(order.delivery_type)}`,
    '',
    'Itens:',
    ...order.items.map(
      (item) =>
        `- ${item.product_name} | ${item.quantity} x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.subtotal)}`,
    ),
    '',
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Desconto: ${formatCurrency(order.discount_amount)}`,
    `Frete: ${formatCurrency(order.shipping_amount)}`,
    `Total: ${formatCurrency(order.total_amount)}`,
    ...(trackingUrl ? ['', `Acompanhar em: ${trackingUrl}`] : []),
  ];

  return lines.join('\n');
}

function buildShareText(order: TrackedOrder, trackingUrl: string) {
  return [
    `Acompanhe o pedido ${order.order_no}.`,
    `Status atual: ${getOrderStatusMeta(order.status).label}.`,
    `${getDeliveryTypeLabel(order.delivery_type)} | ${formatCurrency(order.total_amount)}.`,
    trackingUrl,
  ].join('\n');
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error('Nao foi possivel copiar agora.');
  }
}

export default function PedidoPage() {
  const autoLookupRef = useRef(false);
  const [orderNo, setOrderNo] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);

  const performLookup = useCallback(
    async (payload: {
      orderNo: string;
      customerEmail?: string;
      customerPhone?: string;
    }) => {
      const orderNoValue = payload.orderNo.trim().toUpperCase();
      const emailValue = (payload.customerEmail || '').trim().toLowerCase();
      const phoneValue = normalizePhone(payload.customerPhone || '');

      if (!orderNoValue) {
        setLookupError('Informe o codigo do pedido para continuar.');
        return;
      }

      if (!emailValue && !phoneValue) {
        setLookupError(
          'Use o email ou o telefone da compra para validar o acompanhamento.',
        );
        return;
      }

      setIsLoading(true);
      setLookupError(null);

      try {
        const result = (await api.trackPublicOrder({
          order_no: orderNoValue,
          customer_email: emailValue || undefined,
          customer_phone: phoneValue || undefined,
        })) as TrackedOrder;

        setTrackedOrder(result);
        setOrderNo(orderNoValue);
        setCustomerEmail(emailValue);
        setCustomerPhone(phoneValue);
        saveOrderTrackingContext({
          orderNo: orderNoValue,
          customerEmail: emailValue || undefined,
          customerPhone: phoneValue || undefined,
          customerName: result.customer_name,
        });
      } catch (error: any) {
        const message = error?.message || 'Nao foi possivel localizar esse pedido agora.';
        setTrackedOrder(null);
        setLookupError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const orderParam =
      typeof window === 'undefined'
        ? ''
        : (new URLSearchParams(window.location.search).get('order') || '')
            .trim()
            .toUpperCase();
    const storedContext = readOrderTrackingContext(orderParam || undefined);

    if (orderParam) {
      setOrderNo(orderParam);
    } else if (storedContext?.orderNo) {
      setOrderNo(storedContext.orderNo);
    }

    if (storedContext?.customerEmail) {
      setCustomerEmail(storedContext.customerEmail);
    }

    if (storedContext?.customerPhone) {
      setCustomerPhone(storedContext.customerPhone);
    }

    const autoOrderNo = orderParam || storedContext?.orderNo;
    if (
      !autoLookupRef.current &&
      autoOrderNo &&
      (storedContext?.customerEmail || storedContext?.customerPhone)
    ) {
      autoLookupRef.current = true;
      void performLookup({
        orderNo: autoOrderNo,
        customerEmail: storedContext?.customerEmail,
        customerPhone: storedContext?.customerPhone,
      });
    }
  }, [performLookup]);

  const timeline = useMemo(() => {
    if (!trackedOrder || trackedOrder.status === 'cancelado') {
      return statusFlow.map((step) => ({
        ...step,
        done: false,
        current: false,
      }));
    }

    const currentIndex = statusFlow.findIndex((step) => step.key === trackedOrder.status);

    return statusFlow.map((step, index) => ({
      ...step,
      done: index < currentIndex || trackedOrder.status === 'entregue',
      current: index === currentIndex,
    }));
  }, [trackedOrder]);

  const timelineProgress = useMemo(() => {
    if (!trackedOrder || trackedOrder.status === 'cancelado') {
      return 0;
    }

    const currentIndex = statusFlow.findIndex((step) => step.key === trackedOrder.status);
    if (currentIndex < 0) return 0;
    return Math.round(((currentIndex + 1) / statusFlow.length) * 100);
  }, [trackedOrder]);

  const orderStatusMeta = trackedOrder ? getOrderStatusMeta(trackedOrder.status) : null;
  const trackingUrl = useMemo(
    () => (trackedOrder ? buildTrackingUrl(trackedOrder.order_no) : ''),
    [trackedOrder],
  );
  const nextMilestone = useMemo(
    () => (trackedOrder ? getNextMilestone(trackedOrder) : null),
    [trackedOrder],
  );
  const journeyMoments = useMemo(
    () => (trackedOrder ? buildJourneyMoments(trackedOrder) : []),
    [trackedOrder],
  );
  const fulfillmentGuidance = useMemo(
    () => (trackedOrder ? getFulfillmentGuidance(trackedOrder) : null),
    [trackedOrder],
  );

  const handleShareTracking = useCallback(async () => {
    if (!trackedOrder || !trackingUrl) return;

    const shareText = buildShareText(trackedOrder, trackingUrl);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Pedido ${trackedOrder.order_no}`,
          text: shareText,
          url: trackingUrl,
        });
        toast.success('Acompanhamento pronto para compartilhar.');
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
      }
    }

    await copyText(`${shareText}\n${trackingUrl}`, 'Link de acompanhamento copiado.');
  }, [trackedOrder, trackingUrl]);

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
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-35px_rgba(16,185,129,0.9)]">
              <Store className="size-5 text-accent" />
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
                acompanhamento premium
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Acompanhar pedido
              </h1>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/loja"
              className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08] sm:inline-flex"
            >
              Voltar para a loja
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Entrar no painel
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.16)_0%,rgba(56,189,248,0.12)_28%,rgba(10,14,24,0.96)_72%,rgba(10,14,24,1)_100%)] p-6 shadow-[0_40px_140px_-70px_rgba(2,6,23,1)] sm:p-8 lg:p-10">
          <div className="grid gap-8 xl:grid-cols-[1.15fr,0.85fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">
                <ShieldCheck className="size-4" />
                compra com visibilidade real
              </div>
              <h2 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                O pedido continua bonito e claro mesmo depois do pagamento.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200/88 sm:text-base">
                Informe o codigo do pedido e valide com email ou telefone da compra.
                Aqui voce acompanha status, pagamento, itens e recebimento sem depender de
                atendimento para cada atualizacao.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-300">codigo</p>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                    {orderNo || 'PED-20260315-ABCD'}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Use o identificador entregue no checkout ou no comprovante.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-300">validacao</p>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-white">
                    Email ou telefone
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Mantem o acesso simples para o cliente e seguro para a operacao.
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-300">atualizacao</p>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-white">Em tempo real</p>
                  <p className="mt-2 text-sm text-slate-300">
                    O mesmo status que a equipe move na operacao aparece aqui.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[rgba(5,8,22,0.72)] p-6 shadow-[0_20px_70px_-40px_rgba(2,6,23,1)] backdrop-blur-xl sm:p-7">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                localizar pedido
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Seu acompanhamento em poucos segundos.
              </h3>

              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void performLookup({ orderNo, customerEmail, customerPhone });
                }}
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Codigo do pedido
                  </label>
                  <input
                    type="text"
                    value={orderNo}
                    onChange={(event) => setOrderNo(event.target.value.toUpperCase())}
                    placeholder="PED-20260315-ABCD"
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Email da compra
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    placeholder="cliente@exemplo.com"
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Telefone da compra
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(normalizePhone(event.target.value))}
                    placeholder="11999999999"
                    className={controlClassName}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Voce pode usar email ou telefone. Um dos dois ja basta.
                  </p>
                </div>

                {lookupError && (
                  <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                    {lookupError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Consultando pedido
                    </>
                  ) : (
                    <>
                      Acompanhar agora
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>

        {trackedOrder && orderStatusMeta && (
          <section className="mt-8 grid gap-6 xl:grid-cols-[1.12fr,0.88fr]">
            <div className="space-y-6">
              <article
                className={cn(
                  'overflow-hidden rounded-[32px] border p-6 shadow-[0_30px_120px_-70px_rgba(2,6,23,1)] sm:p-8',
                  orderStatusMeta.panel,
                )}
              >
                <div className="grid gap-6 lg:grid-cols-[1fr,0.9fr]">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white">
                      <BadgeCheck className="size-4" />
                      {orderStatusMeta.label}
                    </div>
                    <h3 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {orderStatusMeta.title}
                    </h3>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-100/88">
                      {orderStatusMeta.description}
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.08] p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-200">
                          pedido
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {trackedOrder.order_no}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.08] p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-200">
                          criado em
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatDate(trackedOrder.created_at)}
                        </p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.08] p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-200">
                          atualizado
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatDate(trackedOrder.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-[rgba(5,8,22,0.42)] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-300">
                          progresso operacional
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                          {timelineProgress}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void performLookup({ orderNo, customerEmail, customerPhone })
                        }
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCcw className={cn('size-4', isLoading && 'animate-spin')} />
                        Atualizar
                      </button>
                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(110,231,183,1)_0%,rgba(34,211,238,1)_100%)] transition-all"
                        style={{ width: `${timelineProgress}%` }}
                      />
                    </div>

                    <div className="mt-6 space-y-3">
                      {timeline.map((step, index) => (
                        <div
                          key={step.key}
                          className={cn(
                            'rounded-2xl border px-4 py-4 transition',
                            step.current
                              ? 'border-white/20 bg-white/[0.1]'
                              : step.done
                                ? 'border-emerald-300/20 bg-emerald-300/10'
                                : 'border-white/10 bg-white/[0.04]',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                                step.current
                                  ? 'border-white/20 bg-white/10 text-white'
                                  : step.done
                                    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                                    : 'border-white/10 bg-transparent text-slate-300',
                              )}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{step.title}</p>
                              <p className="mt-1 text-sm leading-relaxed text-slate-200/78">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {nextMilestone && (
                      <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.08] p-4">
                        <div className="flex items-center gap-2 text-white">
                          <Sparkles className="size-4 text-emerald-200" />
                          <p className="text-sm font-semibold">O que acontece agora</p>
                        </div>
                        <p className="mt-3 text-lg font-semibold tracking-tight text-white">
                          {nextMilestone.title}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-200/80">
                          {nextMilestone.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </article>

              {fulfillmentGuidance && (
                <article className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_120px_-70px_rgba(2,6,23,1)] sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        jornada guiada
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                        O que esperar a partir deste ponto.
                      </h3>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <PackageCheck className="size-3.5" />
                      {getDeliveryTypeLabel(trackedOrder.delivery_type)} via{' '}
                      {getChannelLabel(trackedOrder.channel)}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {journeyMoments.map((moment) => (
                      <div
                        key={moment.eyebrow}
                        className="rounded-[26px] border border-white/10 bg-background/60 p-5"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {moment.eyebrow}
                        </p>
                        <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                          {moment.title}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {moment.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[28px] border border-white/10 bg-background/60 p-5">
                    <div className="flex items-center gap-2 text-foreground">
                      <Clock3 className="size-4" />
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {fulfillmentGuidance.eyebrow}
                      </p>
                    </div>
                    <h4 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                      {fulfillmentGuidance.title}
                    </h4>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {fulfillmentGuidance.description}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {fulfillmentGuidance.bullets.map((bullet) => (
                        <div
                          key={bullet}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4"
                        >
                          <p className="text-sm leading-relaxed text-foreground">{bullet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              )}

              <article className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_120px_-70px_rgba(2,6,23,1)] sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      resumo do pedido
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      Tudo que foi comprado, com o mesmo capricho do checkout.
                    </h3>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void handleShareTracking()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                    >
                      <Share2 className="size-4" />
                      Compartilhar acompanhamento
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          buildReceiptText(trackedOrder, trackingUrl),
                          'Resumo do pedido copiado.',
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                    >
                      <Copy className="size-4" />
                      Copiar comprovante
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr,0.92fr]">
                  <div className="space-y-3">
                    {trackedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold tracking-tight text-foreground">
                              {item.product_name}
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {item.quantity} x {formatCurrency(item.unit_price)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(item.subtotal)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-background/60 p-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatCurrency(trackedOrder.subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span>Desconto</span>
                        <span>{formatCurrency(trackedOrder.discount_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span>{getDeliveryTypeLabel(trackedOrder.delivery_type)}</span>
                        <span>{formatCurrency(trackedOrder.shipping_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-foreground">
                        <span className="text-sm">Total</span>
                        <span className="text-xl font-semibold tracking-tight">
                          {formatCurrency(trackedOrder.total_amount)}
                        </span>
                      </div>
                    </div>

                    {trackedOrder.coupon_code && (
                      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          cupom aplicado
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {trackedOrder.coupon_code}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            </div>

            <div className="space-y-6">
              {trackedOrder.payment && (
                <article className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_120px_-70px_rgba(2,6,23,1)] sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        pagamento
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                        Pagamento e comprovacao sempre por perto.
                      </h3>
                    </div>
                    <div
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.18em]',
                        getPaymentStatusTone(trackedOrder.payment.status),
                      )}
                    >
                      {getPaymentStatusLabel(trackedOrder.payment.status)}
                    </div>
                  </div>

                  <div className="mt-6 rounded-[28px] border border-white/10 bg-background/60 p-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span>Metodo</span>
                        <span>{getPaymentMethodLabel(trackedOrder.payment.method)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                        <span>Status</span>
                        <span>{getPaymentStatusLabel(trackedOrder.payment.status)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-foreground">
                        <span className="text-sm">Valor</span>
                        <span className="text-lg font-semibold tracking-tight">
                          {formatCurrency(trackedOrder.payment.amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {trackedOrder.payment.method === 'pix' &&
                    (trackedOrder.payment.qr_code ||
                      trackedOrder.payment.qr_code_url ||
                      trackedOrder.payment.copy_paste) && (
                      <div className="mt-6 rounded-[28px] border border-white/10 bg-background/60 p-5">
                        <div className="flex items-center gap-2 text-foreground">
                          <ScanQrCode className="size-4" />
                        <p className="text-sm font-semibold">Pix pronto para concluir</p>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Se o pagamento ainda estiver pendente, voce pode retomar daqui com o
                        mesmo QR code do checkout.
                      </p>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                        <p className="text-sm leading-relaxed text-foreground">
                          Mesmo que voce feche esta pagina, o acompanhamento guarda este Pix
                          para retomar depois com o mesmo codigo e o mesmo contexto da compra.
                        </p>
                      </div>

                      {(trackedOrder.payment.qr_code || trackedOrder.payment.qr_code_url) && (
                        <div className="mt-5 flex justify-center">
                            <Image
                              src={
                                trackedOrder.payment.qr_code ||
                                trackedOrder.payment.qr_code_url ||
                                ''
                              }
                              alt="QR Code Pix"
                              width={208}
                              height={208}
                              unoptimized
                              className="h-52 w-52 rounded-[28px] border border-white/10 bg-white object-contain p-3"
                            />
                          </div>
                        )}

                        {trackedOrder.payment.copy_paste && (
                          <div className="mt-5">
                            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              copia e cola
                            </label>
                            <textarea
                              readOnly
                              value={trackedOrder.payment.copy_paste}
                              rows={4}
                              className={cn(controlClassName, 'text-xs leading-relaxed')}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(
                                  trackedOrder.payment?.copy_paste || '',
                                  'Codigo Pix copiado.',
                                )
                              }
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                            >
                              <Copy className="size-4" />
                              Copiar codigo Pix
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </article>
              )}

              <article className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_120px_-70px_rgba(2,6,23,1)] sm:p-8">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  recebimento e contato
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  O cliente segue orientado ate o ultimo detalhe.
                </h3>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-[24px] border border-white/10 bg-background/60 p-4">
                    <div className="flex items-center gap-2 text-foreground">
                      {trackedOrder.delivery_type === 'delivery' ? (
                        <Truck className="size-4" />
                      ) : (
                        <MapPin className="size-4" />
                      )}
                      <p className="text-sm font-semibold">
                        {getDeliveryTypeLabel(trackedOrder.delivery_type)}
                      </p>
                    </div>
                    {trackedOrder.delivery_type === 'delivery' && trackedOrder.delivery_address ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {trackedOrder.delivery_address.street}, {trackedOrder.delivery_address.number}
                        {trackedOrder.delivery_address.complement
                          ? `, ${trackedOrder.delivery_address.complement}`
                          : ''}
                        {' - '}
                        {trackedOrder.delivery_address.neighborhood}
                        {' - '}
                        {trackedOrder.delivery_address.city}/{trackedOrder.delivery_address.state}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        A retirada fica organizada pela equipe assim que o pedido estiver pronto.
                      </p>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-background/60 p-4">
                    <div className="flex items-center gap-2 text-foreground">
                      <Phone className="size-4" />
                      <p className="text-sm font-semibold">Contato validado</p>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {trackedOrder.customer_name ? `${trackedOrder.customer_name}. ` : ''}
                      {trackedOrder.customer_email_masked
                        ? `Email: ${trackedOrder.customer_email_masked}. `
                        : ''}
                      {trackedOrder.customer_phone_masked
                        ? `Telefone: ${trackedOrder.customer_phone_masked}.`
                        : ''}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-background/60 p-4">
                    <div className="flex items-center gap-2 text-foreground">
                      <Package2 className="size-4" />
                      <p className="text-sm font-semibold">Acoes rapidas</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(trackedOrder.order_no, 'Codigo do pedido copiado.')
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                      >
                        <Copy className="size-4" />
                        Copiar codigo
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleShareTracking()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
                      >
                        <Share2 className="size-4" />
                        Compartilhar
                      </button>
                      <Link
                        href="/loja"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90"
                      >
                        Voltar para loja
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
