'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CreditCard, Building2, Smartphone, Shield, Lock, Sparkles, Loader2 } from 'lucide-react';

type PlanoKey = 'comecar' | 'crescer' | 'escalar';

const planos: Record<PlanoKey, {
  nome: string;
  preco: number;
  descricao: string;
  popular?: boolean;
}> = {
  comecar: { nome: 'Começar', preco: 197, descricao: 'Para quem está validando o modelo' },
  crescer: { nome: 'Crescer', preco: 497, descricao: 'Para quem já vende e quer profissionalizar', popular: true },
  escalar: { nome: 'Escalar', preco: 1297, descricao: 'Para operações com várias lojas' },
};

type Pagamento = 'cartao' | 'boleto' | 'pix';

export default function CheckoutPage() {
  const [plano, setPlano] = useState<PlanoKey>('crescer');
  const [pagamento, setPagamento] = useState<Pagamento>('cartao');
  const [step, setStep] = useState<'plano' | 'dados' | 'pagamento' | 'sucesso'>('plano');
  const [loading, setLoading] = useState(false);

  // Form data
  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpfCnpj: '',
    telefone: '',
    empresa: '',
    // Endereço
    cep: '',
    rua: '',
    numero: '',
    cidade: '',
    estado: '',
    // Cartão
    numeroCartao: '',
    validade: '',
    cvv: '',
    nomeCartao: '',
  });

  const p = planos[plano];
  const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSubmit = async () => {
    setLoading(true);
    // Aqui integraria com Stripe/Pagar.me
    // Por enquanto simulamos o fluxo
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setStep('sucesso');
  };

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814]">
      {/* HEADER */}
      <header className="border-b border-[#1a1814]/8">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#1a1814] text-[10px] font-semibold text-[#f6f3ee]">GT</div>
            <span className="text-[15px] font-medium tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>
              GTSoftHub
            </span>
          </Link>
          <div className="flex items-center gap-2 text-[12px] text-[#1a1814]/55">
            <Lock className="h-3.5 w-3.5" />
            <span className="uppercase tracking-[0.16em]">Pagamento seguro</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 py-12">
        {/* STEPPER */}
        <div className="mb-12 flex items-center justify-center gap-2 sm:gap-4">
          {(['plano', 'dados', 'pagamento', 'sucesso'] as const).map((s, i) => {
            const stepIndex = ['plano', 'dados', 'pagamento', 'sucesso'].indexOf(step);
            const isActive = i <= stepIndex;
            const isCurrent = s === step;
            return (
              <div key={s} className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium transition-all duration-300 ${
                      isActive
                        ? isCurrent
                          ? 'bg-[#b8654a] text-[#f6f3ee] scale-110'
                          : 'bg-[#1a1814] text-[#f6f3ee]'
                        : 'border border-[#1a1814]/15 bg-[#f6f3ee] text-[#1a1814]/40'
                    }`}
                  >
                    {isActive && i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`hidden text-[12px] font-medium uppercase tracking-[0.16em] sm:inline ${isActive ? 'text-[#1a1814]' : 'text-[#1a1814]/40'}`}>
                    {s === 'plano' && 'Plano'}
                    {s === 'dados' && 'Dados'}
                    {s === 'pagamento' && 'Pagamento'}
                    {s === 'sucesso' && 'Pronto'}
                  </span>
                </div>
                {i < 3 && <div className={`h-px w-8 sm:w-16 ${isActive && i < stepIndex ? 'bg-[#1a1814]' : 'bg-[#1a1814]/15'}`} />}
              </div>
            );
          })}
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
          {/* CONTEÚDO PRINCIPAL */}
          <div>
            {step === 'plano' && (
              <div className="rounded-[3px] border border-[#1a1814]/15 bg-white/40 p-6 sm:p-8">
                <h1 className="text-[28px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[32px]" style={{ fontFamily: 'var(--font-display)' }}>
                  Escolha seu plano
                </h1>
                <p className="mt-3 text-[15px] text-[#1a1814]/65">
                  Comece com 14 dias grátis. Cancele quando quiser, sem multa.
                </p>

                <div className="mt-8 space-y-4">
                  {Object.entries(planos).map(([key, p]) => (
                    <button
                      key={key}
                      onClick={() => setPlano(key as PlanoKey)}
                      className={`group relative flex w-full items-center justify-between rounded-[3px] border p-6 text-left transition-all duration-300 ${
                        plano === key
                          ? 'border-[#1a1814] bg-[#1a1814] text-[#f6f3ee]'
                          : 'border-[#1a1814]/15 bg-[#f6f3ee] text-[#1a1814] hover:border-[#1a1814]/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                            plano === key
                              ? 'border-2 border-[#b8654a] bg-[#b8654a]/10'
                              : 'border-2 border-[#1a1814]/20 bg-transparent'
                          }`}
                        >
                          {plano === key && <div className="h-3 w-3 rounded-full bg-[#b8654a]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[18px] font-normal tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>
                              {p.nome}
                            </h3>
                            {p.popular && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#b8654a] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#f6f3ee]">
                                <Sparkles className="h-2.5 w-2.5" />
                                Popular
                              </span>
                            )}
                          </div>
                          <p className={`mt-1 text-[13px] ${plano === key ? 'text-[#f6f3ee]/65' : 'text-[#1a1814]/55'}`}>
                            {p.descricao}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-[24px] font-normal leading-none tracking-[-0.02em] ${
                            plano === key ? 'text-[#f6f3ee]' : 'text-[#1a1814]'
                          }`}
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {formatBRL(p.preco)}
                        </div>
                        <div className={`mt-1 text-[11px] ${plano === key ? 'text-[#f6f3ee]/55' : 'text-[#1a1814]/55'}`}>/mês</div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep('dados')}
                  className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a1814] text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#1a1814]/90 active:scale-[0.98]"
                >
                  Continuar
                </button>
              </div>
            )}

            {step === 'dados' && (
              <div className="rounded-[3px] border border-[#1a1814]/15 bg-white/40 p-6 sm:p-8">
                <button onClick={() => setStep('plano')} className="mb-4 inline-flex items-center gap-1 text-[12px] text-[#1a1814]/55 transition-colors hover:text-[#1a1814]">
                  <ArrowLeft className="h-3 w-3" />
                  Voltar
                </button>

                <h1 className="text-[28px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[32px]" style={{ fontFamily: 'var(--font-display)' }}>
                  Seus dados
                </h1>
                <p className="mt-3 text-[15px] text-[#1a1814]/65">
                  Para emitir a nota fiscal e criar sua conta.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nome completo" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} placeholder="Seu nome" required />
                    <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="voce@empresa.com" required />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="CPF ou CNPJ" value={form.cpfCnpj} onChange={(v) => setForm({ ...form, cpfCnpj: v })} placeholder="000.000.000-00" required />
                    <Field label="WhatsApp" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} placeholder="(11) 99999-9999" required />
                  </div>
                  <Field label="Nome da empresa" value={form.empresa} onChange={(v) => setForm({ ...form, empresa: v })} placeholder="Sua loja" />
                </div>

                <button
                  onClick={() => setStep('pagamento')}
                  className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a1814] text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#1a1814]/90 active:scale-[0.98]"
                >
                  Continuar para pagamento
                </button>
              </div>
            )}

            {step === 'pagamento' && (
              <div className="rounded-[3px] border border-[#1a1814]/15 bg-white/40 p-6 sm:p-8">
                <button onClick={() => setStep('dados')} className="mb-4 inline-flex items-center gap-1 text-[12px] text-[#1a1814]/55 transition-colors hover:text-[#1a1814]">
                  <ArrowLeft className="h-3 w-3" />
                  Voltar
                </button>

                <h1 className="text-[28px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[32px]" style={{ fontFamily: 'var(--font-display)' }}>
                  Como você quer pagar?
                </h1>
                <p className="mt-3 text-[15px] text-[#1a1814]/65">
                  Escolha a forma mais confortável para você.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    { k: 'cartao' as const, icon: CreditCard, t: 'Cartão', d: 'Crédito ou débito' },
                    { k: 'pix' as const, icon: Smartphone, t: 'PIX', d: 'Aprovação imediata' },
                    { k: 'boleto' as const, icon: Building2, t: 'Boleto', d: 'Vencimento em 3 dias' },
                  ].map((opt) => (
                    <button
                      key={opt.k}
                      onClick={() => setPagamento(opt.k)}
                      className={`group flex flex-col items-center gap-2 rounded-[3px] border p-5 text-center transition-all duration-300 ${
                        pagamento === opt.k
                          ? 'border-[#1a1814] bg-[#1a1814] text-[#f6f3ee]'
                          : 'border-[#1a1814]/15 bg-[#f6f3ee] text-[#1a1814] hover:border-[#1a1814]/30'
                      }`}
                    >
                      <opt.icon className="h-6 w-6" strokeWidth={1.4} />
                      <div className="text-[14px] font-medium">{opt.t}</div>
                      <div className={`text-[11px] ${pagamento === opt.k ? 'text-[#f6f3ee]/55' : 'text-[#1a1814]/55'}`}>
                        {opt.d}
                      </div>
                    </button>
                  ))}
                </div>

                {pagamento === 'cartao' && (
                  <div className="mt-6 space-y-4 rounded-[3px] border border-[#1a1814]/10 bg-[#f6f3ee] p-5">
                    <Field label="Número do cartão" value={form.numeroCartao} onChange={(v) => setForm({ ...form, numeroCartao: v })} placeholder="0000 0000 0000 0000" />
                    <Field label="Nome no cartão" value={form.nomeCartao} onChange={(v) => setForm({ ...form, nomeCartao: v })} placeholder="Como aparece no cartão" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Validade" value={form.validade} onChange={(v) => setForm({ ...form, validade: v })} placeholder="MM/AA" />
                      <Field label="CVV" value={form.cvv} onChange={(v) => setForm({ ...form, cvv: v })} placeholder="123" />
                    </div>
                  </div>
                )}

                {pagamento === 'pix' && (
                  <div className="mt-6 rounded-[3px] border border-[#1a1814]/10 bg-[#f6f3ee] p-5 text-center">
                    <div className="mx-auto h-32 w-32 rounded-lg bg-[#1a1814] p-3">
                      {/* QR Code simulado */}
                      <svg viewBox="0 0 100 100" className="h-full w-full">
                        {Array.from({ length: 100 }).map((_, i) => {
                          const x = (i % 10) * 10;
                          const y = Math.floor(i / 10) * 10;
                          const isCorner = (x < 30 && y < 30) || (x > 60 && y < 30) || (x < 30 && y > 60);
                          const isCenter = x > 35 && x < 65 && y > 35 && y < 65;
                          const isFill = (i * 7 + i * 13) % 5 < 3;
                          if (isCorner) {
                            return <rect key={i} x={x} y={y} width="10" height="10" fill={i < 90 ? '#f6f3ee' : 'transparent'} />;
                          }
                          if (isCenter) {
                            return <rect key={i} x={x} y={y} width="10" height="10" fill={isFill ? '#f6f3ee' : 'transparent'} />;
                          }
                          return isFill ? <rect key={i} x={x} y={y} width="10" height="10" fill="#f6f3ee" /> : null;
                        })}
                      </svg>
                    </div>
                    <p className="mt-4 text-[13px] text-[#1a1814]/70">
                      QR Code gerado. Escaneie com seu app de banco.
                    </p>
                    <p className="mt-1 text-[11px] text-[#1a1814]/50">
                      Aprovação em até 30 segundos
                    </p>
                  </div>
                )}

                {pagamento === 'boleto' && (
                  <div className="mt-6 rounded-[3px] border border-[#1a1814]/10 bg-[#f6f3ee] p-5 text-center">
                    <Building2 className="mx-auto h-12 w-12 text-[#1a1814]/40" strokeWidth={1.2} />
                    <p className="mt-4 text-[14px] text-[#1a1814]">
                      Boleto será gerado após confirmar
                    </p>
                    <p className="mt-1 text-[12px] text-[#1a1814]/60">
                      Vencimento em 3 dias úteis
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a1814] text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#1a1814]/90 active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Pagar {formatBRL(p.preco)} e começar 14 dias grátis
                    </>
                  )}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#1a1814]/50">
                  <Shield className="h-3 w-3" />
                  <span>Pagamento processado por Stripe. Seus dados estão seguros.</span>
                </div>
              </div>
            )}

            {step === 'sucesso' && (
              <div className="rounded-[3px] border border-[#1a1814]/15 bg-white/40 p-6 sm:p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-8 w-8 text-emerald-700" strokeWidth={2.5} />
                </div>
                <h1 className="mt-6 text-[32px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[40px]" style={{ fontFamily: 'var(--font-display)' }}>
                  Bem-vindo à GTSoftHub
                </h1>
                <p className="mx-auto mt-4 max-w-md text-[15px] text-[#1a1814]/65">
                  Sua conta está ativa. Em 24 horas nossa equipe entra em contato para configurar tudo para você.
                </p>

                <div className="mx-auto mt-8 max-w-md space-y-3 rounded-[3px] border border-[#1a1814]/10 bg-[#f6f3ee] p-5 text-left">
                  <h3 className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55">
                    Próximos passos
                  </h3>
                  {[
                    'Configurar sua loja e produtos',
                    'Treinar o bot de WhatsApp para seu negócio',
                    'Conectar com seu estoque',
                  ].map((step, i) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#1a1814]/20 text-[10px] font-medium text-[#1a1814]">
                        {i + 1}
                      </div>
                      <p className="text-[14px] text-[#1a1814]/80">{step}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href="/login"
                  className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#1a1814]/90 hover:gap-3 active:scale-[0.98]"
                >
                  Entrar na plataforma
                </Link>
              </div>
            )}
          </div>

          {/* RESUMO LATERAL */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[3px] border border-[#1a1814]/15 bg-white/40 p-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Resumo</p>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[40px] font-normal leading-none tracking-[-0.04em]" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatBRL(p.preco)}
                </span>
                <span className="text-[13px] text-[#1a1814]/55">/mês</span>
              </div>

              <p className="mt-2 text-[14px] text-[#1a1814]/80">{p.nome}</p>

              <div className="mt-6 space-y-2 border-t border-[#1a1814]/10 pt-5">
                {[
                  '14 dias grátis',
                  'Cancele quando quiser',
                  'Suporte humano em português',
                  'Setup assistido pela equipe',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-[13px] text-[#1a1814]/70">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#b8654a]" strokeWidth={2.5} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-[#1a1814]/10 pt-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#1a1814]/55">Garantia</p>
                <p className="mt-2 text-[13px] text-[#1a1814]/80">
                  14 dias para experimentar. Se não gostar, devolvemos o valor integral, sem perguntas.
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-[#1a1814]/50">
              🔒 Pagamento processado por Stripe com criptografia 256-bit
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55">
        {label}
        {required && <span className="ml-0.5 text-[#b8654a]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-[3px] border border-[#1a1814]/15 bg-white/80 px-4 py-3 text-[15px] text-[#1a1814] placeholder:text-[#1a1814]/35 transition focus:border-[#1a1814]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#b8654a]/25"
      />
    </div>
  );
}
