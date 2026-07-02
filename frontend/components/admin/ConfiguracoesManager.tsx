'use client';

/**
 * ConfiguracoesManager — tela /admin/configuracoes (T7).
 *
 * Consome useTenantSettings (T6) e edita 3 secoes, cada uma com seu proprio
 * botao "Salvar" (PATCH por secao):
 *  - Loja:      store_name, tagline, description, logo_url, primary_color.
 *  - Horario:   editor por-dia (dom..sab / "0".."6") — toggle Aberto/Fechado +
 *               abre/fecha (HH:MM) por dia + timezone. Ao salvar monta o mapa
 *               BusinessHours SO com os dias Abertos (dias fechados AUSENTES).
 *  - Pagamento: checkboxes de metodos + pix_key + pix_merchant_name.
 *
 * Sinalizacao (onboarding): usa settings.status para avisar o lojista quando
 * algo ainda nao esta configurado (nao bloqueante, sempre visivel).
 *
 * Reusa os padroes do ProductsManager/ProductForm (inputClass/labelClass,
 * feedback ok/err que some em ~6s, estados loading/error/empty).
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarX, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import { useAvailabilityExceptions } from '@/hooks/useAvailabilityExceptions';
import type {
  BusinessHours,
  DayHours,
  PaymentMethod,
  TenantSettingsProjection,
} from '@/lib/types/tenant-settings';
import type {
  CreateStoreExceptionInput,
  StoreException,
  StoreExceptionKind,
} from '@/lib/types/store-exception';

// ---- Constantes de UI ----

const inputClass =
  'h-11 w-full rounded-[4px] border border-[#1a1814]/15 bg-white px-3 text-[14px] text-[#1a1814] outline-none transition focus:border-[#1a1814]/40 disabled:opacity-60';
const labelClass = 'block text-[12px] font-medium text-[#1a1814]/70 mb-1';

/** Dias da semana: chave "0".."6" (0=domingo), rotulo curto. */
const DIAS: { dow: string; label: string }[] = [
  { dow: '0', label: 'Domingo' },
  { dow: '1', label: 'Segunda' },
  { dow: '2', label: 'Terça' },
  { dow: '3', label: 'Quarta' },
  { dow: '4', label: 'Quinta' },
  { dow: '5', label: 'Sexta' },
  { dow: '6', label: 'Sábado' },
];

/** Lista curta de fusos brasileiros (default: America/Sao_Paulo). */
const FUSOS_BR: { tz: string; label: string }[] = [
  { tz: 'America/Sao_Paulo', label: 'São Paulo / Brasília (GMT-3)' },
  { tz: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { tz: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { tz: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { tz: 'America/Recife', label: 'Recife (GMT-3)' },
  { tz: 'America/Belem', label: 'Belém (GMT-3)' },
  { tz: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { tz: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
];

const DEFAULT_TZ = 'America/Sao_Paulo';
const DEFAULT_ABRE = '09:00';
const DEFAULT_FECHA = '18:00';

/** Janela de horario invalida: abertura >= fechamento (ambos "HH:MM", comparaveis lexicalmente). */
function horaInvalida(open: string, close: string): boolean {
  return !!open && !!close && open >= close;
}

const METODOS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
];

type Feedback = { kind: 'ok' | 'err'; text: string };

/** Estado local editavel de um dia (aberto? + faixa). */
interface DiaEstado {
  aberto: boolean;
  open: string;
  close: string;
}

export function ConfiguracoesManager() {
  const { settings, loading, error, update, refetch } = useTenantSettings();

  if (loading) {
    return <CenteredMessage>Carregando configurações…</CenteredMessage>;
  }
  if (error || !settings) {
    return (
      <CenteredMessage>
        <p className="mb-3 text-red-700">{error ?? 'Não foi possível carregar as configurações.'}</p>
        <button onClick={() => refetch()} className="text-[13px] underline">
          Tentar novamente
        </button>
      </CenteredMessage>
    );
  }

  return <ConfiguracoesForm settings={settings} update={update} refetch={refetch} loading={loading} />;
}

// ---- Formulario (settings garantidamente carregado) ----

function ConfiguracoesForm({
  settings,
  update,
  refetch,
  loading,
}: {
  settings: TenantSettingsProjection;
  update: ReturnType<typeof useTenantSettings>['update'];
  refetch: () => void;
  loading: boolean;
}) {
  const { loja, horario, pagamento, status } = settings;

  // ---- Estado: Loja ----
  const [storeName, setStoreName] = useState(loja.store_name ?? '');
  const [tagline, setTagline] = useState(loja.tagline ?? '');
  const [descricao, setDescricao] = useState(loja.description ?? '');
  const [logoUrl, setLogoUrl] = useState(loja.logo_url ?? '');
  // Seeda fiel a projecao (vazio quando null): assim uma cor NAO tocada e omitida
  // do payload. O swatch abaixo cai para #b8654a so na EXIBICAO (isHex()).
  const [primaryColor, setPrimaryColor] = useState(loja.primary_color ?? '');

  // ---- Estado: Horario (por-dia) ----
  const [tz, setTz] = useState(horario.business_hours?.tz ?? DEFAULT_TZ);
  const [dias, setDias] = useState<Record<string, DiaEstado>>(() =>
    initDias(horario.business_hours),
  );

  // ---- Estado: Pagamento ----
  const [metodos, setMetodos] = useState<PaymentMethod[]>(
    () => (pagamento.metodos as PaymentMethod[]) ?? [],
  );
  const [pixKey, setPixKey] = useState(pagamento.pix_key ?? '');
  const [pixMerchant, setPixMerchant] = useState(pagamento.pix_merchant_name ?? '');

  // ---- Feedback por-secao (some sozinho apos 6s no sucesso) ----
  const [feedback, setFeedback] = useState<Record<string, Feedback | null>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const oks = Object.entries(feedback).filter(([, f]) => f?.kind === 'ok');
    if (oks.length === 0) return;
    const id = setTimeout(() => {
      setFeedback((prev) => {
        const next = { ...prev };
        for (const [k, f] of Object.entries(next)) {
          if (f?.kind === 'ok') next[k] = null;
        }
        return next;
      });
    }, 6000);
    return () => clearTimeout(id);
  }, [feedback]);

  async function salvar(secao: string, dto: Parameters<typeof update>[0]) {
    setSaving(secao);
    const res = await update(dto);
    setSaving(null);
    setFeedback((prev) => ({
      ...prev,
      [secao]: res.ok
        ? { kind: 'ok', text: 'Alterações salvas.' }
        : { kind: 'err', text: res.error ?? 'Falha ao salvar.' },
    }));
  }

  function salvarLoja() {
    // Só inclui no payload os campos com valor: o DTO backend (@IsUrl/@Matches)
    // rejeita string vazia, e @IsOptional só pula null/undefined — mandar '' daria
    // 400. Omitir o campo vazio = "não tocar" (contrato PATCH por seção).
    void salvar('loja', {
      loja: {
        ...(storeName.trim() ? { store_name: storeName.trim() } : {}),
        ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
        ...(descricao.trim() ? { description: descricao.trim() } : {}),
        ...(logoUrl.trim() ? { logo_url: logoUrl.trim() } : {}),
        ...(primaryColor.trim() ? { primary_color: primaryColor.trim() } : {}),
      },
    });
  }

  // Algum dia aberto com janela invalida (abertura >= fechamento)?
  const horarioInvalido = DIAS.some(({ dow }) => {
    const d = dias[dow];
    return !!d?.aberto && horaInvalida(d.open, d.close);
  });

  function salvarHorario() {
    if (horarioInvalido) {
      setFeedback((prev) => ({
        ...prev,
        horario: {
          kind: 'err',
          text: 'Corrija os horários: a abertura deve ser antes do fechamento.',
        },
      }));
      return;
    }
    // Nenhum dia aberto -> limpar horário (business_hours: null). Um mapa vazio
    // ({tz, days:{}}) seria rejeitado pelo DTO (fail-closed exige >=1 dia).
    void salvar('horario', { horario: { business_hours: montarBusinessHours(tz, dias) } });
  }

  function salvarPagamento() {
    // Mesma regra do salvarLoja: pix vazio é OMITIDO (não mandado como '').
    void salvar('pagamento', {
      pagamento: {
        metodos,
        ...(pixKey.trim() ? { pix_key: pixKey.trim() } : {}),
        ...(pixMerchant.trim() ? { pix_merchant_name: pixMerchant.trim() } : {}),
      },
    });
  }

  function toggleDia(dow: string) {
    setDias((prev) => {
      const atual = prev[dow] ?? { aberto: false, open: DEFAULT_ABRE, close: DEFAULT_FECHA };
      return { ...prev, [dow]: { ...atual, aberto: !atual.aberto } };
    });
  }

  function setHora(dow: string, campo: 'open' | 'close', valor: string) {
    setDias((prev) => {
      const atual = prev[dow] ?? { aberto: true, open: DEFAULT_ABRE, close: DEFAULT_FECHA };
      return { ...prev, [dow]: { ...atual, [campo]: valor } };
    });
  }

  function toggleMetodo(m: PaymentMethod) {
    setMetodos((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  // Avisos de sinalizacao (onboarding).
  const avisos = useMemo(() => buildAvisos(status), [status]);

  // Nenhum dia aberto -> a loja fica sem horario (o bot nao oferece retirada).
  const nenhumDiaAberto = useMemo(
    () => !DIAS.some(({ dow }) => dias[dow]?.aberto),
    [dias],
  );

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      {/* Cabecalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Admin</p>
          <h1
            className="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Configurações
          </h1>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#1a1814]/15 px-4 text-[13px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Sinalizacao (onboarding) */}
      {avisos.length > 0 && (
        <div className="mt-6 space-y-2">
          {avisos.map((a) => (
            <div
              key={a.key}
              role="status"
              className="flex items-start gap-2 rounded-[4px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
            >
              <Settings className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.6} />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- Secao: Loja ---- */}
      <Secao titulo="Loja" onSalvar={salvarLoja} saving={saving === 'loja'} feedback={feedback.loja}>
        <div>
          <label className={labelClass} htmlFor="cfg-store-name">
            Nome da loja
          </label>
          <input
            id="cfg-store-name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className={inputClass}
            placeholder="Ex: Doceria da Ana"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cfg-tagline">
            Slogan (tagline)
          </label>
          <input
            id="cfg-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={inputClass}
            placeholder="Uma frase curta sobre a loja"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cfg-description">
            Descrição
          </label>
          <textarea
            id="cfg-description"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className={`${inputClass} h-auto py-2`}
            placeholder="Descrição da loja (opcional)"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cfg-logo-url">
            Logo (URL)
          </label>
          <input
            id="cfg-logo-url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className={inputClass}
            placeholder="https://exemplo.com/logo.png"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cfg-primary-color">
            Cor principal
          </label>
          <div className="flex items-center gap-3">
            <input
              id="cfg-primary-color"
              type="color"
              value={isHex(primaryColor) ? primaryColor : '#b8654a'}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-[4px] border border-[#1a1814]/15 bg-white p-1"
              aria-label="Cor principal (seletor)"
            />
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className={`${inputClass} max-w-[160px]`}
              placeholder="#b8654a"
              aria-label="Cor principal (hex)"
            />
          </div>
        </div>
      </Secao>

      {/* ---- Secao: Horario (por-dia) ---- */}
      <Secao
        titulo="Horário de funcionamento"
        onSalvar={salvarHorario}
        saving={saving === 'horario'}
        saveDisabled={horarioInvalido}
        feedback={feedback.horario}
      >
        <div>
          <label className={labelClass} htmlFor="cfg-tz">
            Fuso horário
          </label>
          <select
            id="cfg-tz"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className={inputClass}
          >
            {FUSOS_BR.map((f) => (
              <option key={f.tz} value={f.tz}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {DIAS.map(({ dow, label }) => {
            const d = dias[dow] ?? { aberto: false, open: DEFAULT_ABRE, close: DEFAULT_FECHA };
            return (
              <div
                key={dow}
                data-testid={`dia-${dow}`}
                className="flex flex-col gap-2 rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex w-28 shrink-0 items-center gap-2">
                  <span className="text-[14px] font-medium text-[#1a1814]">{label}</span>
                </div>
                <label className="flex items-center gap-2 text-[13px] text-[#1a1814]/70">
                  <input
                    type="checkbox"
                    checked={d.aberto}
                    onChange={() => toggleDia(dow)}
                    aria-label={`${label} aberto`}
                    className="h-4 w-4"
                  />
                  {d.aberto ? 'Aberto' : 'Fechado'}
                </label>
                {d.aberto && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={d.open}
                      onChange={(e) => setHora(dow, 'open', e.target.value)}
                      aria-label={`${label} abre`}
                      className={`${inputClass} h-9 w-32`}
                    />
                    <span className="text-[#1a1814]/40">até</span>
                    <input
                      type="time"
                      value={d.close}
                      onChange={(e) => setHora(dow, 'close', e.target.value)}
                      aria-label={`${label} fecha`}
                      className={`${inputClass} h-9 w-32`}
                    />
                  </div>
                )}
                {d.aberto && horaInvalida(d.open, d.close) && (
                  <p className="text-[12px] text-red-700 sm:w-full">
                    A abertura deve ser antes do fechamento.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {nenhumDiaAberto && (
          <div
            role="status"
            className="rounded-[4px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
          >
            Loja sem horário definido — retirada não será oferecida.
          </div>
        )}
        <p className="text-[12px] text-[#1a1814]/50">
          Dias marcados como Fechado ficam de fora do horário — o bot não afirma horário nesses dias.
        </p>
      </Secao>

      {/* ---- Secao: Pagamento ---- */}
      <Secao
        titulo="Pagamento"
        onSalvar={salvarPagamento}
        saving={saving === 'pagamento'}
        feedback={feedback.pagamento}
      >
        <div>
          <span className={labelClass}>Formas de pagamento aceitas</span>
          <div className="flex flex-wrap gap-4">
            {METODOS.map((m) => (
              <label key={m.value} className="flex items-center gap-2 text-[14px] text-[#1a1814]">
                <input
                  type="checkbox"
                  checked={metodos.includes(m.value)}
                  onChange={() => toggleMetodo(m.value)}
                  aria-label={m.label}
                  className="h-4 w-4"
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="cfg-pix-key">
            Chave PIX
          </label>
          <input
            id="cfg-pix-key"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className={inputClass}
            placeholder="e-mail, CPF/CNPJ, telefone ou chave aleatória"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="cfg-pix-merchant">
            Nome do recebedor (PIX)
          </label>
          <input
            id="cfg-pix-merchant"
            value={pixMerchant}
            onChange={(e) => setPixMerchant(e.target.value)}
            className={inputClass}
            placeholder="Nome que aparece no comprovante"
          />
        </div>
      </Secao>

      {/* ---- Secao: Excecoes / Feriados (mesma familia do Horario) ---- */}
      <ExcecoesSection />
    </div>
  );
}

// ---- Secao: Excecoes / Feriados (4a secao — consome useAvailabilityExceptions) ----

/**
 * Datas pontuais em que a loja foge do horario recorrente: fechada o dia todo
 * (`closed`) ou com horario especial (`custom_hours`). v1 = lista de datas
 * (sem calendario visual). Optimistic + rollback vem do hook (T6); aqui so a UI.
 */
function ExcecoesSection() {
  const { exceptions, loading, error, add, remove, closeToday } =
    useAvailabilityExceptions();

  // ---- Estado do formulario "adicionar" ----
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<StoreExceptionKind>('closed');
  const [open, setOpen] = useState(DEFAULT_ABRE);
  const [close, setClose] = useState(DEFAULT_FECHA);

  // ---- Feedback (some sozinho apos 6s no sucesso) + estado "salvando" ----
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);

  // Horário especial com janela inválida (abertura >= fechamento)?
  const excInvalida = kind === 'custom_hours' && horaInvalida(open, close);

  useEffect(() => {
    if (feedback?.kind !== 'ok') return;
    const id = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(id);
  }, [feedback]);

  function report(res: { ok: boolean; error?: string }, sucesso: string) {
    setFeedback(
      res.ok
        ? { kind: 'ok', text: sucesso }
        : { kind: 'err', text: res.error ?? 'Falha ao salvar.' },
    );
  }

  async function adicionar() {
    if (!date) {
      setFeedback({ kind: 'err', text: 'Escolha uma data para a exceção.' });
      return;
    }
    if (kind === 'custom_hours' && horaInvalida(open, close)) {
      setFeedback({ kind: 'err', text: 'A abertura deve ser antes do fechamento.' });
      return;
    }
    // Monta o input: `closed` NAO leva open/close; `custom_hours` leva ambos.
    const input: CreateStoreExceptionInput =
      kind === 'custom_hours'
        ? { date, kind, open, close }
        : { date, kind };
    setBusy(true);
    const res = await add(input);
    setBusy(false);
    report(res, 'Exceção adicionada.');
    if (res.ok) {
      // Reseta o formulario apos sucesso: o tipo volta ao default "Fechado". Sem isto,
      // o proximo lancamento herda "Horario especial" e a lojista marca o tipo errado (A5).
      setDate('');
      setKind('closed');
      setOpen(DEFAULT_ABRE);
      setClose(DEFAULT_FECHA);
    }
  }

  async function fecharHoje() {
    setBusy(true);
    const res = await closeToday();
    setBusy(false);
    report(res, 'Loja marcada como fechada hoje.');
  }

  async function remover(id: string) {
    setBusy(true);
    const res = await remove(id);
    setBusy(false);
    report(res, 'Exceção removida.');
  }

  return (
    <section
      data-testid="secao-excecoes"
      className="mt-8 rounded-[6px] border border-[#1a1814]/10 bg-white p-6"
    >
      <div className="flex items-center gap-2">
        <CalendarX className="h-5 w-5 text-[#1a1814]/70" strokeWidth={1.6} />
        <h2 className="text-[18px] font-medium text-[#1a1814]">Exceções / Feriados</h2>
      </div>
      <p className="mt-2 text-[13px] text-[#1a1814]/55">
        Datas pontuais em que a loja foge do horário normal — fechada o dia todo ou
        com horário especial.
      </p>

      {/* ---- Formulario: adicionar exceção ---- */}
      <div className="mt-5 flex flex-col gap-4 rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="cfg-exc-date">
              Data da exceção
            </label>
            <input
              id="cfg-exc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <span className={labelClass}>Tipo</span>
            <div className="flex h-11 items-center gap-4">
              <label className="flex items-center gap-2 text-[14px] text-[#1a1814]">
                <input
                  type="radio"
                  name="cfg-exc-kind"
                  checked={kind === 'closed'}
                  onChange={() => setKind('closed')}
                  aria-label="Fechado"
                  className="h-4 w-4"
                />
                Fechado
              </label>
              <label className="flex items-center gap-2 text-[14px] text-[#1a1814]">
                <input
                  type="radio"
                  name="cfg-exc-kind"
                  checked={kind === 'custom_hours'}
                  onChange={() => setKind('custom_hours')}
                  aria-label="Horário especial"
                  className="h-4 w-4"
                />
                Horário especial
              </label>
            </div>
          </div>
        </div>

        {kind === 'custom_hours' && (
          <div className="flex items-center gap-2">
            <div>
              <label className={labelClass} htmlFor="cfg-exc-open">
                Abre
              </label>
              <input
                id="cfg-exc-open"
                type="time"
                value={open}
                onChange={(e) => setOpen(e.target.value)}
                aria-label="Abre"
                className={`${inputClass} h-9 w-32`}
              />
            </div>
            <span className="mt-6 text-[#1a1814]/40">até</span>
            <div>
              <label className={labelClass} htmlFor="cfg-exc-close">
                Fecha
              </label>
              <input
                id="cfg-exc-close"
                type="time"
                value={close}
                onChange={(e) => setClose(e.target.value)}
                aria-label="Fecha"
                className={`${inputClass} h-9 w-32`}
              />
            </div>
          </div>
        )}

        {excInvalida && (
          <p className="text-[12px] text-red-700">
            A abertura deve ser antes do fechamento.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void adicionar()}
            disabled={busy || excInvalida}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#1a1814] px-6 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Adicionar'}
          </button>
          <button
            type="button"
            onClick={() => void fecharHoje()}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#1a1814]/15 px-5 text-[14px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5 disabled:opacity-50"
          >
            Fechar hoje
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-5 rounded-[4px] border px-4 py-3 text-[13px] ${
            feedback.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* ---- Lista das exceções futuras ---- */}
      <div className="mt-6">
        <h3 className="text-[13px] font-medium text-[#1a1814]/70">Próximas exceções</h3>
        {loading ? (
          <p className="mt-3 text-[13px] text-[#1a1814]/55">Carregando exceções…</p>
        ) : error ? (
          <p className="mt-3 text-[13px] text-red-700">{error}</p>
        ) : exceptions.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#1a1814]/55">
            Nenhuma exceção cadastrada.
          </p>
        ) : (
          <ul data-testid="excecoes-lista" className="mt-3 space-y-2">
            {exceptions.map((exc) => (
              <li
                key={exc.id}
                className="flex items-center justify-between gap-3 rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-[#1a1814]">
                    {formatExcDate(exc.date)}
                  </span>
                  <span className="text-[13px] text-[#1a1814]/60">
                    {describeExc(exc)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void remover(exc.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border border-[#1a1814]/15 px-3 py-1.5 text-[13px] font-medium text-[#1a1814] transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---- Sub-componentes ----

function Secao({
  titulo,
  children,
  onSalvar,
  saving,
  saveDisabled,
  feedback,
}: {
  titulo: string;
  children: React.ReactNode;
  onSalvar: () => void;
  saving: boolean;
  saveDisabled?: boolean;
  feedback: Feedback | null | undefined;
}) {
  return (
    <section className="mt-8 rounded-[6px] border border-[#1a1814]/10 bg-white p-6">
      <h2 className="text-[18px] font-medium text-[#1a1814]">{titulo}</h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>

      {feedback && (
        <div
          className={`mt-5 rounded-[4px] border px-4 py-3 text-[13px] ${
            feedback.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={onSalvar}
          disabled={saving || saveDisabled}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#1a1814] px-6 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : `Salvar ${titulo.split(' ')[0].toLowerCase()}`}
        </button>
      </div>
    </section>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-8 text-center text-[14px] text-[#1a1814]/65">
        {children}
      </div>
    </div>
  );
}

// ---- Helpers puros ----

/** Semeia o estado por-dia a partir do business_hours (ausente = Fechado). */
function initDias(bh: BusinessHours | null | undefined): Record<string, DiaEstado> {
  const out: Record<string, DiaEstado> = {};
  for (const { dow } of DIAS) {
    const dh = bh?.days?.[dow];
    out[dow] = dh
      ? { aberto: true, open: dh.open, close: dh.close }
      : { aberto: false, open: DEFAULT_ABRE, close: DEFAULT_FECHA };
  }
  return out;
}

/**
 * Monta o BusinessHours SO com os dias marcados como Aberto.
 * Dias Fechados ficam AUSENTES do mapa (contrato: ausente = fechado).
 * NENHUM dia aberto -> null (limpar horario): o DTO rejeita um mapa vazio
 * (fail-closed exige >=1 dia), mas aceita null como "sem horario definido".
 */
function montarBusinessHours(tz: string, dias: Record<string, DiaEstado>): BusinessHours | null {
  const days: { [dow: string]: DayHours } = {};
  for (const { dow } of DIAS) {
    const d = dias[dow];
    if (d?.aberto) {
      days[dow] = { open: d.open, close: d.close };
    }
  }
  if (Object.keys(days).length === 0) {
    return null;
  }
  return { tz: tz || DEFAULT_TZ, days };
}

function isHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

/**
 * Formata a data civil "YYYY-MM-DD" para exibição (dd/mm/aaaa), sem passar por
 * `new Date()` — evitar o shift de fuso que joga a data um dia pra trás.
 */
function formatExcDate(date: string): string {
  const [y, m, d] = date.split('-');
  return y && m && d ? `${d}/${m}/${y}` : date;
}

/** Rótulo curto de uma exceção: "Fechado" ou "09:00–13:00". */
function describeExc(exc: StoreException): string {
  if (exc.kind === 'custom_hours' && exc.open && exc.close) {
    return `${exc.open}–${exc.close}`;
  }
  return 'Fechado';
}

function buildAvisos(status: TenantSettingsProjection['status']): { key: string; text: string }[] {
  const avisos: { key: string; text: string }[] = [];
  if (!status.hasBusinessHours) {
    avisos.push({
      key: 'horario',
      text: 'Sua loja ainda não tem horário definido. Configure abaixo para o bot informar quando você atende.',
    });
  }
  if (!status.hasPixKey) {
    avisos.push({
      key: 'pix',
      text: 'Chave PIX não configurada. Adicione sua chave para receber pagamentos por PIX.',
    });
  }
  return avisos;
}
