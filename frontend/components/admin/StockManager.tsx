'use client';

/**
 * StockManager — tela de gestão de estoque (leitura + mutações T5b).
 *
 * Consome useAdminData() do AdminDataProvider — NÃO chama useStock() diretamente.
 * Badges derivados de stock-status.ts (fonte única).
 * Mutações com optimistic update: o estado compartilhado do provider
 * propaga o re-render para o selo da aba (AdminNav) e para o Início automaticamente.
 */

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Package, AlertTriangle, X, Clock, SlidersHorizontal } from 'lucide-react';
import { useAdminData } from '@/components/admin/shell/AdminDataProvider';
import { stockStatus, isAttention, STATUS_META } from '@/lib/stock-status';
import type { StockSummaryEntry } from '@/lib/types/product';
import type { StockHistoryItem } from '@/hooks/useStock';

// Mapeamento rótulo → enum do backend
const TIPO_LABELS: { label: string; value: 'COMPRA' | 'PERDA' | 'DEVOLUCAO' | 'AJUSTE' }[] = [
  { label: 'Compra',     value: 'COMPRA'    },
  { label: 'Perda',      value: 'PERDA'     },
  { label: 'Devolução',  value: 'DEVOLUCAO' },
  { label: 'Correção',   value: 'AJUSTE'    },
];

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

// ---- Modal de ajuste de estoque ----

function ModalAjuste({
  product,
  onClose,
}: {
  product: StockSummaryEntry;
  onClose: () => void;
}) {
  const { adjustStock } = useAdminData();

  const [tipo, setTipo] = useState<'COMPRA' | 'PERDA' | 'DEVOLUCAO' | 'AJUSTE'>('COMPRA');
  // "quantidade" para Compra/Perda/Devolução; "contado" para Correção (modo-contagem)
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isCorrecao = tipo === 'AJUSTE';
  const currentStock = product.current_stock ?? 0;

  // Delta calculado para Correção: contado - current_stock
  const contadoNum = parseInt(quantidade, 10);
  const deltaCorrecao = isCorrecao && !isNaN(contadoNum) ? contadoNum - currentStock : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const qtd = parseInt(quantidade, 10);
    if (isNaN(qtd) || qtd < 0) {
      setErro('Informe um valor válido.');
      return;
    }

    let delta: number;

    if (isCorrecao) {
      // Modo-contagem: delta = valor contado − estoque atual (pode ser negativo ou positivo)
      delta = qtd - currentStock;
    } else if (tipo === 'PERDA') {
      // Perda: quantidade positiva no UI → delta negativo no wire
      delta = -qtd;
    } else {
      // Compra e Devolução: delta positivo
      delta = qtd;
    }

    setSalvando(true);
    const result = await adjustStock(product.id, tipo, delta, motivo || undefined);
    setSalvando(false);

    if (result.ok) {
      onClose();
    } else {
      // 422 INSUFFICIENT_STOCK → mensagem específica
      if (result.code === 'INSUFFICIENT_STOCK') {
        setErro('Estoque insuficiente para esta saída.');
      } else {
        setErro(result.error ?? 'Falha ao ajustar o estoque.');
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#1a1814]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel */}
      <div className="relative z-10 w-full max-w-sm rounded-t-[12px] sm:rounded-[8px] bg-[#f6f3ee] border border-[#1a1814]/10 p-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2
              className="text-[18px] font-normal tracking-[-0.02em] text-[#1a1814]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Ajustar Estoque
            </h2>
            <p className="mt-0.5 text-[12px] text-[#1a1814]/55">{product.name}</p>
            <p className="text-[12px] text-[#1a1814]/55">
              Estoque atual: <strong className="text-[#1a1814]">{currentStock}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar modal de ajuste"
            className="shrink-0 text-[#1a1814]/40 transition hover:text-[#1a1814]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          {/* Tipo de movimentação */}
          <div>
            <label className="block text-[12px] font-medium text-[#1a1814]/70 mb-1">
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as typeof tipo);
                setQuantidade('');
                setErro(null);
              }}
              className="w-full rounded-[4px] border border-[#1a1814]/15 bg-white px-3 py-2 text-[13px] text-[#1a1814] focus:border-[#b8654a] focus:outline-none"
            >
              {TIPO_LABELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Campo de valor (quantidade ou valor contado) */}
          <div>
            <label className="block text-[12px] font-medium text-[#1a1814]/70 mb-1">
              {isCorrecao ? 'Valor contado (estoque real na prateleira)' : 'Quantidade'}
            </label>
            <input
              type="number"
              min="0"
              value={quantidade}
              onChange={(e) => { setQuantidade(e.target.value); setErro(null); }}
              placeholder={isCorrecao ? 'Quantas unidades há na prateleira?' : '0'}
              className="w-full rounded-[4px] border border-[#1a1814]/15 bg-white px-3 py-2 text-[13px] text-[#1a1814] focus:border-[#b8654a] focus:outline-none"
              required
            />

            {/* Preview do delta calculado para Correção */}
            {isCorrecao && quantidade !== '' && !isNaN(contadoNum) && (
              <p
                className={`mt-1 text-[12px] font-medium ${
                  deltaCorrecao === 0
                    ? 'text-[#1a1814]/55'
                    : deltaCorrecao! > 0
                      ? 'text-emerald-700'
                      : 'text-red-700'
                }`}
                data-testid="delta-preview"
              >
                {deltaCorrecao === 0
                  ? 'Nenhuma alteração'
                  : `ajuste: ${formatDelta(deltaCorrecao!)}`}
              </p>
            )}
          </div>

          {/* Motivo (opcional) */}
          <div>
            <label className="block text-[12px] font-medium text-[#1a1814]/70 mb-1">
              Motivo <span className="text-[#1a1814]/40">(opcional)</span>
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: reposição mensal"
              className="w-full rounded-[4px] border border-[#1a1814]/15 bg-white px-3 py-2 text-[13px] text-[#1a1814] focus:border-[#b8654a] focus:outline-none"
            />
          </div>

          {/* Erro */}
          {erro && (
            <div
              className="rounded-[4px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
              role="alert"
              data-testid="erro-ajuste"
            >
              {erro}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[4px] border border-[#1a1814]/15 py-2 text-[13px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 rounded-[4px] bg-[#1a1814] py-2 text-[13px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/85 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Drawer de extrato de movimentações ----

function ExtratoDrawer({
  product,
  onClose,
}: {
  product: StockSummaryEntry;
  onClose: () => void;
}) {
  const { history } = useAdminData();
  const [items, setItems] = useState<StockHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega histórico ao montar; cancela requisição pendente se desmontar antes de resolver
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    history(product.id)
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Falha ao carregar extrato.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, history]);

  const status = stockStatus(
    product.available_stock as number | null | undefined,
    product.min_stock as number | null | undefined,
  );
  const meta = STATUS_META[status];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#1a1814]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel */}
      <div className="relative z-10 w-full max-w-md max-h-[80vh] overflow-y-auto rounded-t-[12px] sm:rounded-[8px] bg-[#f6f3ee] border border-[#1a1814]/10 p-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2
              className="text-[18px] font-normal tracking-[-0.02em] text-[#1a1814]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {product.name}
            </h2>
            <div className="mt-1 flex flex-wrap gap-3 text-[12px] text-[#1a1814]/60">
              <span>Atual: <strong className="text-[#1a1814]">{product.current_stock ?? 0}</strong></span>
              <span>Reservado: <strong className="text-[#1a1814]">{product.reserved_stock ?? 0}</strong></span>
              <span>Disponível: <strong className="text-[#1a1814]">{product.available_stock ?? 0}</strong></span>
              <span>Mínimo: <strong className="text-[#1a1814]">{product.min_stock ?? 0}</strong></span>
            </div>
            <span
              className={`mt-2 inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[11px] font-medium ${meta.classes}`}
            >
              {meta.label}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 text-[#1a1814]/40 transition hover:text-[#1a1814]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Extrato */}
        <div className="border-t border-[#1a1814]/8 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[#1a1814]/40" />
            <h3 className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#1a1814]/50">
              Extrato
            </h3>
          </div>

          {loading ? (
            <p className="text-center text-[13px] text-[#1a1814]/50 py-8">Carregando…</p>
          ) : error ? (
            <div className="rounded-[4px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {error}
            </div>
          ) : !items || items.length === 0 ? (
            <p className="text-center text-[13px] text-[#1a1814]/50 py-8">
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-[4px] border border-[#1a1814]/8 bg-white px-3 py-2 text-[13px]"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-[#1a1814]">{item.tipo}</span>
                    {item.motivo && (
                      <span className="ml-2 text-[#1a1814]/55">· {item.motivo}</span>
                    )}
                    <p className="text-[11px] text-[#1a1814]/45 mt-0.5">{formatDate(item.created_at)}</p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <span
                      className={`font-medium ${item.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {formatDelta(item.delta)}
                    </span>
                    <p className="text-[11px] text-[#1a1814]/50">→ {item.saldo_resultante}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Componente principal ----

export function StockManager() {
  const {
    summary,
    stockLoading: loading,
    stockError: error,
    refetchStock: refetch,
  } = useAdminData();

  const [apenasAtencao, setApenasAtencao] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<StockSummaryEntry | null>(null);
  const [produtoAjuste, setProdutoAjuste] = useState<StockSummaryEntry | null>(null);

  const produtos = summary?.products ?? summary?.items ?? [];

  const filtrados = apenasAtencao
    ? produtos.filter((p) =>
        isAttention(
          stockStatus(
            p.available_stock as number | null | undefined,
            p.min_stock as number | null | undefined,
          ),
        ),
      )
    : produtos;

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
            Admin
          </p>
          <h1
            className="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Estoque
          </h1>
          {summary && (
            <p className="mt-1 text-[13px] text-[#1a1814]/55">
              {summary.total_products} produtos ·{' '}
              <span className="text-amber-700">{summary.low_stock_count} baixo</span> ·{' '}
              <span className="text-red-700">{summary.out_of_stock_count} esgotado</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setApenasAtencao((v) => !v)}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition ${
              apenasAtencao
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-[#1a1814]/15 text-[#1a1814] hover:bg-[#1a1814]/5'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            {apenasAtencao ? 'Todos os produtos' : 'Precisam de atenção'}
          </button>
          <button
            onClick={() => void refetch()}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#1a1814]/15 px-4 text-[13px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mt-8">
        {loading ? (
          <CenteredMessage>Carregando estoque…</CenteredMessage>
        ) : error ? (
          <CenteredMessage>
            <p className="mb-3 text-red-700">{error}</p>
            <button onClick={() => void refetch()} className="text-[13px] underline">
              Tentar novamente
            </button>
          </CenteredMessage>
        ) : filtrados.length === 0 ? (
          <CenteredMessage>
            <Package className="mx-auto mb-3 h-8 w-8 text-[#1a1814]/30" />
            {produtos.length === 0
              ? 'Nenhum produto no estoque ainda.'
              : 'Nenhum produto precisa de atenção.'}
          </CenteredMessage>
        ) : (
          <div className="space-y-2">
            {filtrados.map((produto) => (
              <ProdutoRow
                key={produto.id}
                produto={produto}
                onVerExtrato={() => setProdutoSelecionado(produto)}
                onAjustar={() => setProdutoAjuste(produto)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer do extrato */}
      {produtoSelecionado && (
        <ExtratoDrawer
          product={produtoSelecionado}
          onClose={() => setProdutoSelecionado(null)}
        />
      )}

      {/* Modal de ajuste */}
      {produtoAjuste && (
        <ModalAjuste
          product={produtoAjuste}
          onClose={() => setProdutoAjuste(null)}
        />
      )}
    </div>
  );
}

// ---- Edição inline de mínimo ----

function EditarMinimo({
  produto,
}: {
  produto: StockSummaryEntry;
}) {
  const { setMin } = useAdminData();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(produto.min_stock ?? 0));
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) inputRef.current?.focus();
  }, [editando]);

  async function salvar() {
    const num = parseInt(valor, 10);
    if (isNaN(num) || num < 0) {
      setEditando(false);
      setValor(String(produto.min_stock ?? 0));
      return;
    }
    setSalvando(true);
    await setMin(produto.id, num);
    setSalvando(false);
    setEditando(false);
  }

  if (!editando) {
    return (
      <button
        onClick={() => { setEditando(true); setValor(String(produto.min_stock ?? 0)); }}
        title="Editar mínimo"
        className="text-[12px] text-[#1a1814]/55 hover:text-[#b8654a] underline decoration-dotted"
        data-testid={`editar-min-${produto.id}`}
      >
        Mínimo: <strong>{produto.min_stock ?? 0}</strong>
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void salvar(); }}
      className="flex items-center gap-1"
    >
      <span className="text-[12px] text-[#1a1814]/55">Mínimo:</span>
      <input
        ref={inputRef}
        type="number"
        min="0"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => void salvar()}
        disabled={salvando}
        className="w-14 rounded-[3px] border border-[#b8654a]/50 px-1.5 py-0.5 text-[12px] text-[#1a1814] focus:outline-none"
        aria-label="Estoque mínimo"
        data-testid={`input-min-${produto.id}`}
      />
    </form>
  );
}

// ---- Linha de produto ----

function ProdutoRow({
  produto,
  onVerExtrato,
  onAjustar,
}: {
  produto: StockSummaryEntry;
  onVerExtrato: () => void;
  onAjustar: () => void;
}) {
  const status = stockStatus(
    produto.available_stock as number | null | undefined,
    produto.min_stock as number | null | undefined,
  );
  const meta = STATUS_META[status];

  return (
    <div
      className="flex flex-col gap-3 rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-medium text-[#1a1814]">{produto.name}</span>
          <span
            className={`inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[11px] font-medium ${meta.classes}`}
            data-testid={`badge-status-${produto.id}`}
          >
            {meta.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-[12px] text-[#1a1814]/55">
          <span>Atual: <strong className="text-[#1a1814]">{produto.current_stock ?? 0}</strong></span>
          <span>Reservado: <strong className="text-[#1a1814]">{produto.reserved_stock ?? 0}</strong></span>
          <span>Disponível: <strong className="text-[#1a1814]">{produto.available_stock ?? 0}</strong></span>
          <EditarMinimo produto={produto} />
        </div>
      </div>

      <div className="flex gap-2 sm:shrink-0">
        <button
          onClick={onAjustar}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-full border border-[#1a1814]/15 px-4 text-[13px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5 sm:self-auto"
          data-testid={`btn-ajustar-${produto.id}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Ajustar
        </button>
        <button
          onClick={onVerExtrato}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-full border border-[#1a1814]/15 px-4 text-[13px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5 sm:self-auto"
        >
          <Clock className="h-3.5 w-3.5" />
          Extrato
        </button>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-8 text-center text-[14px] text-[#1a1814]/65">
      {children}
    </div>
  );
}
