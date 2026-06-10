'use client';

import { Check, X, Sparkles, ArrowRight } from 'lucide-react';

/**
 * Comparação "antes/depois" - vida sem GTSoftHub vs com.
 */
export function ComparacaoAntesDepois() {
  const semGT = [
    { t: 'Anotar vendas no caderno ou planilha confusa' },
    { t: 'Responder cliente no WhatsApp até meia-noite' },
    { t: 'Vender algo que não tem em estoque' },
    { t: 'Reunião toda segunda pra entender o que aconteceu' },
    { t: '3 sistemas diferentes pra mesma loja' },
    { t: 'Não saber quanto ganhou de verdade no mês' },
  ];

  const comGT = [
    { t: 'Sistema registra tudo automaticamente' },
    { t: 'Bot de WhatsApp responde e vende 24/7' },
    { t: 'Estoque em tempo real em todos os canais' },
    { t: 'Painel mostra tudo de uma vez, sem planilha' },
    { t: 'Loja, PDV, WhatsApp e admin num só lugar' },
    { t: 'Relatórios automáticos com seus números reais' },
  ];

  return (
    <div className="grid gap-px bg-[#1a1814]/8 sm:grid-cols-2">
      {/* SEM GTSoftHub */}
      <div className="bg-[#f6f3ee] p-6 sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100">
            <X className="h-4 w-4 text-rose-600" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-rose-600/70">
              Antes
            </p>
            <h3 className="text-[20px] font-normal leading-[1.1] tracking-[-0.01em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
              Sem GTSoftHub
            </h3>
          </div>
        </div>

        <ul className="space-y-3">
          {semGT.map((item) => (
            <li key={item.t} className="flex items-start gap-3 text-[14px] text-[#1a1814]/60">
              <div className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
                <X className="h-2.5 w-2.5 text-rose-500" strokeWidth={3} />
              </div>
              <span className="line-through decoration-rose-300/60">{item.t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* COM GTSoftHub */}
      <div className="relative bg-[#1a1814] p-6 text-[#f6f3ee] sm:p-10">
        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[#b8654a]/20 blur-2xl" />

        <div className="relative mb-6 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#b8654a]/20">
            <Check className="h-4 w-4 text-[#b8654a]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#b8654a]">
              Depois
            </p>
            <h3 className="text-[20px] font-normal leading-[1.1] tracking-[-0.01em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
              Com GTSoftHub
            </h3>
          </div>
        </div>

        <ul className="space-y-3">
          {comGT.map((item) => (
            <li key={item.t} className="flex items-start gap-3 text-[14px] text-[#f6f3ee]">
              <div className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#b8654a]/20">
                <Check className="h-2.5 w-2.5 text-[#b8654a]" strokeWidth={3} />
              </div>
              <span>{item.t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * ComparaçãoConcorrentes - por que somos diferentes
 */
export function ComparacaoConcorrentes() {
  const itens: Array<{ feature: string; gts: boolean | string; outros: boolean | string }> = [
    { feature: 'Bot de WhatsApp nativo', gts: 'Incluso', outros: 'Integrar separado' },
    { feature: 'Setup assistido pela equipe', gts: true, outros: 'Você sozinho' },
    { feature: 'Estoque em tempo real', gts: true, outros: 'Sync periódico' },
    { feature: 'Sem fidelidade', gts: true, outros: '12 meses' },
    { feature: 'Cancele quando quiser', gts: true, outros: 'Multa' },
    { feature: 'Loja + PDV + Admin', gts: 'Tudo junto', outros: 'Módulos separados' },
    { feature: 'Suporte em português', gts: 'Humano', outros: 'Chatbot' },
  ];

  return (
    <div className="overflow-hidden rounded-[3px] border border-[#1a1814]/15">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#1a1814]/15 bg-[#f6f3ee]">
            <th className="px-4 py-4 text-left text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 sm:px-6">
              Feature
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814] sm:px-6">
              <div className="flex items-center justify-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#b8654a]" />
                GTSoftHub
              </div>
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 sm:px-6">
              Outros
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => (
            <tr
              key={item.feature}
              className={idx % 2 === 0 ? 'bg-[#f6f3ee]' : 'bg-[#efe9df]'}
            >
              <td className="px-4 py-3 text-[13px] text-[#1a1814] sm:px-6">{item.feature}</td>
              <td className="px-4 py-3 text-center sm:px-6">
                {item.gts === true ? (
                  <Check className="mx-auto h-4 w-4 text-[#b8654a]" strokeWidth={2.5} />
                ) : (
                  <span className="inline-block rounded-full bg-[#b8654a]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#b8654a]">
                    {item.gts}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center sm:px-6">
                {item.outros === true ? (
                  <Check className="mx-auto h-4 w-4 text-[#1a1814]/40" strokeWidth={2} />
                ) : (
                  <span className="text-[12px] text-[#1a1814]/60">
                    {item.outros}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
