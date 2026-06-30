'use client';

/**
 * /pdv/caixa — tela cheia "modo caixa" (spec §3, §4).
 *
 * Casca: autenticada, FORA do AdminShell (sem a nav do admin). Reusa o MESMO
 * mecanismo de auth do admin (`useAuth`) e a MESMA camada de dados de produtos
 * (`useProducts` -> `apiClient.getProducts`). Sem sessao -> redireciona /login
 * (o admin usa um render-gate com link; aqui a Task 6/spec §3.1 pedem redirect real).
 *
 * Orquestra as pecas prontas:
 *  - PdvProductSearch (esquerda): products do useProducts + onAdd do usePdvSale.addProduct
 *  - PdvCart (direita): ligado ao usePdvSale
 *  - PdvPaymentModal (overlay ao pagar): fastPass + showCoupon=false + callbacks do hook
 *
 * Atalhos: foco na busca ao montar; F2 abre o pagamento (carrinho nao-vazio);
 * Esc fecha o modal / limpa a venda (confirmacao se houver itens). Enter no campo
 * de busca adiciona o 1o resultado — tratado dentro do PdvProductSearch.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Store } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { usePdvSale } from '@/hooks/usePdvSale';
import { DEFAULT_PDV_CUSTOMER_NAME } from '@/lib/pdv/build-order';
import { PdvProductSearch } from '@/components/pdv/PdvProductSearch';
import { PdvCart } from '@/components/pdv/PdvCart';
import { PdvPaymentModal } from '@/components/pdv/PdvPaymentModal';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}

export default function CaixaPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Auth-gate reusando o useAuth do admin; sem sessao -> redireciona /login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <CenteredMessage>Verificando seu acesso…</CenteredMessage>;
  }
  if (!isAuthenticated) {
    // Redirect em voo — nao vaza o conteudo do caixa.
    return <CenteredMessage>Redirecionando para o login…</CenteredMessage>;
  }

  return <CaixaScreen />;
}

/**
 * Tela do caixa em si — so monta depois do auth-gate (assim os hooks de dados/venda
 * nao rodam para um usuario nao autenticado).
 */
function CaixaScreen() {
  const { products } = useProducts();

  const [customerName, setCustomerName] = useState('');
  const sale = usePdvSale({ customerName });

  const [paymentOpen, setPaymentOpen] = useState(false);
  // Input de valor recebido = string local (o modal espera string); espelha no hook (number).
  const [cashReceivedInput, setCashReceivedInput] = useState('');

  const searchInputRef = useRef<HTMLDivElement>(null);

  const openPayment = useCallback(() => {
    if (sale.items.length === 0) return;
    sale.beginPayment();
    setPaymentOpen(true);
  }, [sale]);

  const closePayment = useCallback(() => {
    // Fecha sem finalizar — carrinho intacto (spec §5.1 onClose).
    setPaymentOpen(false);
  }, []);

  const handleNewSale = useCallback(() => {
    sale.newSale();
    setCashReceivedInput('');
    setPaymentOpen(false);
    // Devolve o foco a busca para a proxima venda.
    const input = searchInputRef.current?.querySelector('input');
    input?.focus();
  }, [sale]);

  const handleClearSale = useCallback(() => {
    if (sale.items.length === 0) return;
    if (window.confirm('Descartar esta venda? Os itens do carrinho serão removidos.')) {
      sale.clear();
    }
  }, [sale]);

  const handleCashReceivedChange = useCallback(
    (value: string) => {
      setCashReceivedInput(value);
      // Aceita "5", "5,50" ou "5.50" -> number (troco e calculo de tela).
      const parsed = Number(value.replace(',', '.'));
      sale.setCashReceived(Number.isFinite(parsed) ? parsed : 0);
    },
    [sale],
  );

  // Atalhos globais: F2 abre o pagamento; Esc fecha o modal / limpa a venda.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        if (!paymentOpen && !sale.completedSale) openPayment();
        return;
      }
      if (e.key === 'Escape') {
        if (paymentOpen) {
          // No modal: Esc fecha (sem finalizar). Apos sucesso, fecha o resumo.
          if (sale.completedSale) {
            handleNewSale();
          } else {
            closePayment();
          }
          return;
        }
        // Na tela: Esc limpa a venda (confirma se houver itens).
        handleClearSale();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [paymentOpen, sale.completedSale, openPayment, closePayment, handleNewSale, handleClearSale]);

  // Foco inicial na busca (o input ja tem autoFocus; reforça apos montar).
  useEffect(() => {
    const input = searchInputRef.current?.querySelector('input');
    input?.focus();
  }, []);

  // Mapeia o carrinho do hook -> a forma que o modal apresenta.
  const saleSummaryItems = useMemo(
    () =>
      sale.items.map((item) => ({
        id: item.produto_id,
        name: item.name,
        price: item.unit_price,
        quantity: item.quantity,
        stock: item.stock,
      })),
    [sale.items],
  );

  const itemsCount = useMemo(
    () => sale.items.reduce((sum, i) => sum + i.quantity, 0),
    [sale.items],
  );

  // Mapeia o completedSale do hook -> o estado de sucesso do modal.
  const completedSaleView = useMemo(() => {
    if (!sale.completedSale) return null;
    const c = sale.completedSale;
    return {
      orderNo: c.order_no,
      total: c.total,
      paymentMethod: c.method,
      itemsCount,
      changeAmount: c.method === 'dinheiro' ? c.change : undefined,
    };
  }, [sale.completedSale, itemsCount]);

  const handleCopyReceipt = useCallback(() => {
    const c = sale.completedSale;
    if (!c) return;
    const lines = [
      'Comprovante de venda',
      c.order_no ? `Pedido: ${c.order_no}` : null,
      `Total: ${currencyFormatter.format(c.total)}`,
      `Pagamento: ${c.method}`,
      c.method === 'dinheiro' ? `Troco: ${currencyFormatter.format(c.change)}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    void navigator.clipboard?.writeText(lines);
  }, [sale.completedSale]);

  const trimmedName = customerName.trim();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      {/* Topbar — enxuta (ferramenta, nao landing). */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Store className="size-4" />
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-slate-950">Caixa</h1>
            <p className="text-[11px] text-slate-500">Venda de balcão</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            <span className="hidden uppercase tracking-[0.16em] md:inline">Cliente</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={DEFAULT_PDV_CUSTOMER_NAME}
              aria-label="Nome do cliente"
              className="h-9 w-40 rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <Link
            href="/admin"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <LogOut className="size-3.5" />
            Sair → Admin
          </Link>
        </div>
      </header>

      {/* Layout 2 painÃ©is: produtos (flex-1, esquerda) + carrinho FIXO a direita.
          h-screen sem scroll de pagina — so a grade e a lista do carrinho rolam. */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
        <section
          ref={searchInputRef}
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3"
        >
          <PdvProductSearch products={products} onAdd={sale.addProduct} />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden">
          <PdvCart
            items={sale.items}
            total={sale.total}
            onInc={sale.inc}
            onDec={sale.dec}
            onRemove={sale.remove}
            onClear={handleClearSale}
            onPay={openPayment}
            payDisabled={sale.items.length === 0}
          />
        </section>
      </main>

      {/* Modal de pagamento (overlay) */}
      {paymentOpen && (
        <PdvPaymentModal
          saleSummaryItems={saleSummaryItems}
          saleSummaryTotal={sale.total}
          orderData={null}
          paymentMethod={sale.method}
          onPaymentMethodChange={(method) => sale.setMethod(method as typeof sale.method)}
          cashReceived={cashReceivedInput}
          onCashReceivedChange={handleCashReceivedChange}
          cashChange={sale.change}
          couponCode=""
          onCouponCodeChange={() => {}}
          paymentLoading={sale.paymentLoading}
          paymentError={sale.paymentError}
          paymentData={null}
          completedSale={completedSaleView}
          fastPass
          showCoupon={false}
          onCreateOrderAndPayment={sale.submitSale}
          onConfirmPayment={() => {}}
          onCopyReceipt={handleCopyReceipt}
          onNewSale={handleNewSale}
          onClose={closePayment}
        />
      )}

      {/* Acessibilidade: nome efetivo do cliente (default visivel a leitores de tela). */}
      <span className="sr-only" data-testid="pdv-customer-name">
        {trimmedName || DEFAULT_PDV_CUSTOMER_NAME}
      </span>
    </div>
  );
}
