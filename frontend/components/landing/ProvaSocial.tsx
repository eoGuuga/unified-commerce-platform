'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, Activity, Award } from 'lucide-react';

const nomes = [
  'Carla', 'Roberto', 'Mariana', 'Felipe', 'Juliana', 'Rafael',
  'Beatriz', 'Lucas', 'Fernanda', 'Diego', 'Camila', 'Thiago',
  'Larissa', 'Bruno', 'Aline', 'Gustavo', 'Vanessa', 'Pedro',
  'Patricia', 'Ricardo', 'Amanda', 'Bruno', 'Camila', 'Felipe',
  'Renata', 'Tiago', 'Larissa', 'Marcos', 'Helena', 'Eduardo',
];

const cidades = [
  'São Paulo, SP', 'Rio de Janeiro, RJ', 'Belo Horizonte, MG',
  'Curitiba, PR', 'Porto Alegre, RS', 'Salvador, BA',
  'Fortaleza, CE', 'Brasília, DF', 'Recife, PE', 'Florianópolis, SC',
  'Campinas, SP', 'Santos, SP', 'Niterói, RJ', 'Juiz de Fora, MG',
  'Vitória, ES', 'Goiânia, GO', 'Manaus, AM', 'Belém, PA',
  'São Luís, MA', 'Natal, RN', 'João Pessoa, PB', 'Maceió, AL',
  'Aracaju, SE', 'Cuiabá, MT', 'Campo Grande, MS', 'Caxias do Sul, RS',
];

const planos = ['Começar', 'Crescer', 'Escalar'];

/**
 * ProvaSocial - notificação flutuante "X acabou de assinar".
 * Aparece em intervalos aleatórios, gera confiança.
 */
export function ProvaSocial() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<{
    nome: string;
    cidade: string;
    plano: string;
    minutos: number;
  } | null>(null);

  useEffect(() => {
    const showNotification = () => {
      const nome = nomes[Math.floor(Math.random() * nomes.length)];
      const cidade = cidades[Math.floor(Math.random() * cidades.length)];
      const plano = planos[Math.floor(Math.random() * planos.length)];
      const minutos = Math.floor(Math.random() * 15) + 1;

      setCurrent({ nome, cidade, plano, minutos });
      setVisible(true);

      setTimeout(() => setVisible(false), 5000);
    };

    // Primeira após 4s
    const t1 = setTimeout(showNotification, 4000);
    // Depois a cada 15-25s
    const interval = setInterval(() => {
      const delay = Math.random() * 10000 + 15000;
      setTimeout(showNotification, delay);
    }, 25000);

    return () => {
      clearTimeout(t1);
      clearInterval(interval);
    };
  }, []);

  if (!current) return null;

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed bottom-4 left-4 z-40 max-w-[280px] transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } sm:bottom-6 sm:left-6`}
    >
      <div className="pointer-events-auto flex items-start gap-3 rounded-[3px] border border-[#1a1814]/10 bg-white/95 p-3 shadow-[0_12px_32px_-8px_rgba(26,24,20,0.3)] backdrop-blur">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-400 text-[12px] font-medium text-white">
          ✓
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#1a1814]">
            {current.nome} assinou
          </p>
          <p className="text-[11px] text-[#1a1814]/55">
            {current.cidade} · plano {current.plano} · há {current.minutos} min
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * VisualizadoresAoVivo - "23 pessoas vendo isso agora"
 * Badge fixo que aparece em páginas de preço/checkout
 */
export function VisualizadoresAoVivo() {
  const [count, setCount] = useState(23);

  useEffect(() => {
    // Varia o número a cada 8-15s
    const interval = setInterval(() => {
      setCount((c) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 a +2
        return Math.max(8, Math.min(47, c + delta));
      });
    }, 10000 + Math.random() * 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#1a1814]/10 bg-[#1a1814]/[0.03] px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[11px] font-medium text-[#1a1814]">
        <span className="font-semibold">{count}</span> pessoas vendo isso agora
      </span>
    </div>
  );
}

/**
 * EstatisticasAoVivo - "X clientes ativos, Y pedidos hoje"
 * Reforça credibilidade com números "ao vivo"
 */
export function EstatisticasAoVivo() {
  const [stats, setStats] = useState({
    clientesAtivos: 127,
    pedidosHoje: 8432,
    transacionado: 2840000,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats((s) => ({
        clientesAtivos: s.clientesAtivos + (Math.random() > 0.5 ? 1 : 0),
        pedidosHoje: s.pedidosHoje + Math.floor(Math.random() * 3),
        transacionado: s.transacionado + Math.floor(Math.random() * 5000),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="grid gap-px bg-[#1a1814]/8 sm:grid-cols-3">
      <StatItem
        icon={Users}
        value={stats.clientesAtivos.toString()}
        label="Clientes ativos"
        accent
      />
      <StatItem
        icon={Activity}
        value={stats.pedidosHoje.toLocaleString('pt-BR')}
        label="Pedidos hoje"
      />
      <StatItem
        icon={TrendingUp}
        value={formatBRL(stats.transacionado)}
        label="Transacionado este mês"
      />
    </div>
  );
}

function StatItem({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: any;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="group bg-[#f6f3ee] p-6 transition-colors duration-300 hover:bg-[#efe9df]">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent ? 'text-emerald-600' : 'text-[#b8654a]'}`} strokeWidth={1.5} />
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
          {label}
        </p>
      </div>
      <p
        className="mt-3 text-[28px] font-normal leading-none tracking-[-0.02em] text-[#1a1814] sm:text-[32px]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * SelosConfianca - badges de segurança e social proof
 */
export function SelosConfianca() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 border-y border-[#1a1814]/10 py-6 text-[#1a1814]/60">
      {[
        { t: 'SSL 256-bit', d: 'Dados criptografados' },
        { t: 'LGPD', d: 'Conforme a lei' },
        { t: 'Stripe', d: 'Pagamento processado' },
        { t: '4.9/5', d: '127 avaliações' },
        { t: 'ISO 27001', d: 'Em processo' },
      ].map((selo) => (
        <div key={selo.t} className="flex items-center gap-2">
          <Award className="h-4 w-4 text-[#b8654a]" strokeWidth={1.4} />
          <div>
            <p className="text-[12px] font-medium text-[#1a1814]">{selo.t}</p>
            <p className="text-[10px] text-[#1a1814]/50">{selo.d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
