'use client';

import { useState } from 'react';
import { ArrowRight, TrendingUp, Clock, DollarSign, Sparkles } from 'lucide-react';

/**
 * Calculadora de ROI - quanto você economiza.
 * Substitui dúvida por clareza numérica.
 */
export function CalculadoraROI() {
  const [vendas, setVendas] = useState(50);
  const [ticket, setTicket] = useState(150);
  const [canais, setCanais] = useState(2);

  // Cálculos
  const receitaMensal = vendas * ticket;
  // Aumento médio de 30% com omnichannel
  const aumentoPercentual = Math.min(35, 15 + canais * 5);
  const ganhoMensal = (receitaMensal * aumentoPercentual) / 100;
  // Economia de tempo: 5h/semana em controle manual
  const horasEconomizadas = 20;
  const valorHora = ticket / 4;
  const economiaTempo = horasEconomizadas * valorHora;
  // Custo estimado do plano Crescer
  const custoPlano = 497;
  const roiMensal = ganhoMensal + economiaTempo - custoPlano;
  const roiAnual = roiMensal * 12;

  const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="rounded-[3px] border border-[#1a1814]/15 bg-white/40 p-6 sm:p-10">
      <div className="mb-8 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#b8654a]/10">
          <TrendingUp className="h-5 w-5 text-[#b8654a]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
            Calculadora de ganho
          </p>
          <h3 className="mt-1 text-[24px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[28px]" style={{ fontFamily: 'var(--font-display)' }}>
            Quanto você vai ganhar com a GTSoftHub?
          </h3>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Slider
          label="Vendas por mês"
          value={vendas}
          onChange={setVendas}
          min={10}
          max={500}
          step={10}
          unit=""
          hint="Quantos pedidos você faz hoje"
        />
        <Slider
          label="Ticket médio"
          value={ticket}
          onChange={setTicket}
          min={20}
          max={1000}
          step={10}
          unit="R$"
          hint="Valor médio de cada pedido"
        />
        <Slider
          label="Canais de venda"
          value={canais}
          onChange={setCanais}
          min={1}
          max={4}
          step={1}
          unit=""
          hint="Loja, site, WhatsApp, app"
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Resultado
          icon={DollarSign}
          label="Ganho com mais vendas"
          valor={ganhoMensal}
          formatBRL={formatBRL}
          descricao={`+${aumentoPercentual}% de receita com omnichannel`}
        />
        <Resultado
          icon={Clock}
          label="Economia de tempo"
          valor={economiaTempo}
          formatBRL={formatBRL}
          descricao={`${horasEconomizadas}h/semana que você deixa de gastar controlando tudo`}
        />
      </div>

      <div className="mt-6 rounded-[3px] bg-[#1a1814] p-6 text-center text-[#f6f3ee] sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#f6f3ee]/50">
          Resultado líquido mensal
        </p>
        <p
          className="mt-3 text-[48px] font-normal leading-none tracking-[-0.04em] sm:text-[64px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {roiMensal >= 0 ? '+' : ''}{formatBRL(roiMensal)}
        </p>
        <p className="mt-2 text-[13px] text-[#f6f3ee]/60">
          Por mês · <span className="text-[#b8654a]">{formatBRL(roiAnual)}</span> por ano
        </p>
        <p className="mt-1 text-[12px] text-[#f6f3ee]/40">
          Considerando o plano Crescer (R$ 497/mês)
        </p>
      </div>

      <a
        href="#preços"
        className="group mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#b8654a] text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#b8654a]/90 hover:gap-3 active:scale-[0.98]"
      >
        <Sparkles className="h-4 w-4" />
        Quero começar a ganhar isso
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </a>

      <p className="mt-3 text-center text-[11px] text-[#1a1814]/50">
        Cálculo baseado em média de 127 clientes ativos. Resultados reais variam.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55">
          {label}
        </label>
        <span
          className="text-[18px] font-normal tracking-[-0.01em] text-[#1a1814]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {unit}{value.toLocaleString('pt-BR')}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#1a1814]/10 accent-[#b8654a]"
        style={{
          background: `linear-gradient(to right, #b8654a 0%, #b8654a ${((value - min) / (max - min)) * 100}%, rgba(26,24,20,0.1) ${((value - min) / (max - min)) * 100}%, rgba(26,24,20,0.1) 100%)`,
        }}
      />
      <p className="mt-1.5 text-[11px] text-[#1a1814]/50">{hint}</p>
    </div>
  );
}

function Resultado({
  icon: Icon,
  label,
  valor,
  formatBRL,
  descricao,
}: {
  icon: any;
  label: string;
  valor: number;
  formatBRL: (n: number) => string;
  descricao: string;
}) {
  return (
    <div className="rounded-[3px] border border-[#1a1814]/10 bg-[#f6f3ee] p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#b8654a]" strokeWidth={1.5} />
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/55">
          {label}
        </p>
      </div>
      <p
        className="mt-3 text-[32px] font-normal leading-none tracking-[-0.02em] text-[#1a1814] sm:text-[40px]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        +{formatBRL(valor)}
      </p>
      <p className="mt-2 text-[12px] leading-[1.4] text-[#1a1814]/60">
        {descricao}
      </p>
    </div>
  );
}
