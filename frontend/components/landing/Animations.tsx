'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import Link from 'next/link';
import { MessageCircle, ArrowRight, ArrowUpRight, Sparkles, ChevronDown, Check } from 'lucide-react';

// ============================================
// SCROLL REVEAL - fade-in com slide-up
// Sempre visível no SSR; anima quando entra na viewport
// ============================================
export function ScrollReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Inicia como visível para SSR + no-JS users
  const [isVisible, setIsVisible] = useState(true);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    // Reseta para invisível apenas no client (depois do hydration)
    setIsVisible(false);
    setHasAnimated(false);

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 800ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 800ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// SCROLL PARALLAX
// ============================================
export function ScrollParallax({
  children,
  speed = 0.3,
  className = '',
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.scrollY;
      const elementTop = scrolled + rect.top;
      const distance = scrolled - elementTop;
      setOffset(distance * speed);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ transform: `translateY(${offset}px)`, willChange: 'transform' }}>
      {children}
    </div>
  );
}

// ============================================
// SCROLL COUNT UP - anima números
// ============================================
export function ScrollCountUp({
  value,
  duration = 1500,
  className = '',
  style,
}: {
  value: string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState('0');
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const numMatch = value.match(/[\d,.]+/);
          if (!numMatch) {
            setDisplayValue(value);
            return;
          }
          const numStr = numMatch[0].replace(/,/g, '');
          const target = parseFloat(numStr);
          const prefix = value.substring(0, numMatch.index);
          const suffix = value.substring(numMatch.index! + numMatch[0].length);

          if (isNaN(target)) {
            setDisplayValue(value);
            return;
          }

          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            const formatted = target % 1 === 0 ? Math.floor(current).toString() : current.toFixed(1);
            setDisplayValue(`${prefix}${formatted}${suffix}`);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <div ref={ref} className={className} style={style}>
      {displayValue}
    </div>
  );
}

// ============================================
// METRIC CARD - hover lift (sem count-up para evitar "0" inicial)
// ============================================
export function MetricCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="group transition-transform duration-500 hover:-translate-y-1">
      <div
        className="text-[36px] font-normal leading-none tracking-[-0.03em] text-[#1a1814] sm:text-[44px]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/50">
        {label}
      </div>
    </div>
  );
}

// ============================================
// WHATSAPP MOCKUP - simulação visual de conversa real
// Cores oficiais do WhatsApp Web: bg #efeae2, bubble cliente #fff, bubble bot #d9fdd3
// ============================================
export function WhatsAppMockup({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleBubbles, setVisibleBubbles] = useState(0);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Bolha 1 (cliente) aparece em 600ms
          setTimeout(() => setVisibleBubbles((v) => Math.max(v, 1)), 600);
          // Digitando em 1800ms
          setTimeout(() => setShowTyping(true), 1800);
          // Bolha 2 (bot) aparece em 3000ms (digitando some)
          setTimeout(() => {
            setShowTyping(false);
            setVisibleBubbles((v) => Math.max(v, 2));
          }, 3000);
          // Bolha 3 (bot) com produto aparece em 4500ms
          setTimeout(() => setVisibleBubbles((v) => Math.max(v, 3)), 4500);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-2xl border border-black/10 shadow-lg ${className}`}
      style={{
        // Fundo oficial do WhatsApp (papel de parede com textura sutil)
        backgroundColor: '#efeae2',
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='%23d9d2c5' fill-opacity='0.15'%3E%3Cpath d='M30 10 L40 30 L30 50 L20 30 Z'/%3E%3C/g%3E%3C/svg%3E\")",
      }}
    >
      {/* Header do WhatsApp */}
      <div className="flex items-center gap-3 border-b border-black/10 bg-[#f0f2f5] px-3 py-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[#111b21]">GTSoftHub Bot</p>
          <p className="truncate text-[11px] text-emerald-600">online</p>
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="space-y-2 p-3">
        {/* Bolha cliente (branca) */}
        <div
          className="ml-auto max-w-[80%] rounded-lg rounded-tr-none bg-white px-2.5 py-1.5 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-all duration-500"
          style={{
            opacity: visibleBubbles >= 1 ? 1 : 0,
            transform: visibleBubbles >= 1 ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          <p>Oi! Vcs têm a caneca personalizada?</p>
          <p className="mt-1 text-right text-[10px] text-[#667781]">14:23 ✓✓</p>
        </div>

        {/* "Bot digitando..." */}
        {showTyping && (
          <div className="max-w-[80%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781]" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781]" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781]" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Bolha bot 1 (verde claro) */}
        <div
          className="max-w-[80%] rounded-lg rounded-tl-none bg-[#d9fdd3] px-2.5 py-1.5 text-[13px] text-[#111b21] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-all duration-500"
          style={{
            opacity: visibleBubbles >= 2 ? 1 : 0,
            transform: visibleBubbles >= 2 ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          <p>Oi! Temos sim 😊</p>
          <p className="mt-1.5">Tenho 3 modelos. Quer ver?</p>
          <p className="mt-1 text-right text-[10px] text-[#667781]">14:23 ✓✓</p>
        </div>

        {/* Bolha bot 2 (com card de produto) */}
        <div
          className="max-w-[85%] overflow-hidden rounded-lg rounded-tl-none bg-[#d9fdd3] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-all duration-500"
          style={{
            opacity: visibleBubbles >= 3 ? 1 : 0,
            transform: visibleBubbles >= 3 ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          <div className="bg-emerald-600/20 px-2.5 py-1.5 text-[13px] text-[#111b21]">
            <p className="font-medium">🛍️ 3 modelos disponíveis</p>
          </div>
          <div className="space-y-1.5 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 rounded-md bg-white/60 p-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded bg-emerald-200" />
                <span className="text-[12px]">Caneca A</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700">R$ 29</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md bg-white/60 p-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded bg-amber-200" />
                <span className="text-[12px]">Caneca B</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700">R$ 35</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md bg-white/60 p-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded bg-rose-200" />
                <span className="text-[12px]">Caneca C</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700">R$ 32</span>
            </div>
          </div>
          <div className="bg-emerald-600/10 px-2.5 py-1.5">
            <button className="w-full text-[12px] font-medium text-emerald-700">
              Ver catálogo completo →
            </button>
          </div>
        </div>
      </div>

      {/* Input do WhatsApp (visual) */}
      <div className="flex items-center gap-2 border-t border-black/10 bg-[#f0f2f5] px-2 py-2">
        <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[12px] text-[#667781]">
          Mensagem
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MÓDULO VISUAL - mini-UI SVG por módulo
// ViewBox 200x100, padding generoso, alinhamento consistente
// ============================================
export function MóduloVisual({ tipo }: { tipo: 'loja' | 'pdv' | 'admin' | 'estoque' }) {
  return (
    <div className="relative mb-6 h-32 overflow-hidden rounded-[3px] border border-[#1a1814]/8 bg-gradient-to-br from-[#1a1814]/[0.04] via-[#1a1814]/[0.02] to-transparent">
      {tipo === 'loja' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none" preserveAspectRatio="xMidYMid meet">
          {/* 4 cards de produto lado a lado */}
          {[30, 70, 110, 150].map((x, i) => (
            <g key={i}>
              <rect x={x} y={25 + (i % 2) * 5} width="32" height="45" rx="1" fill="#1a1814" fillOpacity={0.06 + i * 0.02} />
              <rect x={x + 2} y={27 + (i % 2) * 5} width="28" height="22" rx="0.5" fill="#1a1814" fillOpacity={0.1 + i * 0.02} />
              <line x1={x + 4} y1={56 + (i % 2) * 5} x2={x + 20} y2={56 + (i % 2) * 5} stroke="#1a1814" strokeOpacity="0.2" strokeWidth="1" />
              <line x1={x + 4} y1={62 + (i % 2) * 5} x2={x + 14} y2={62 + (i % 2) * 5} stroke="#1a1814" strokeOpacity="0.15" strokeWidth="1" />
              {i === 3 && (
                <>
                  <circle cx={x + 26} cy={65 + (i % 2) * 5} r="2" fill="#b8654a" fillOpacity="0.7" />
                  <text x={x + 16} y={42 + (i % 2) * 5} textAnchor="middle" fill="#1a1814" fillOpacity="0.3" fontSize="8" fontFamily="serif" fontStyle="italic">+</text>
                </>
              )}
            </g>
          ))}
        </svg>
      )}

      {tipo === 'pdv' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none" preserveAspectRatio="xMidYMid meet">
          {/* Recibo à esquerda */}
          <rect x="20" y="20" width="90" height="60" rx="2" fill="#1a1814" fillOpacity="0.06" />
          <rect x="20" y="20" width="90" height="10" rx="2" fill="#1a1814" fillOpacity="0.12" />
          {/* Linhas do recibo */}
          <rect x="26" y="38" width="2" height="2" rx="1" fill="#1a1814" fillOpacity="0.4" />
          <line x1="32" y1="39" x2="100" y2="39" stroke="#1a1814" strokeOpacity="0.2" strokeWidth="1" />
          <rect x="26" y="48" width="2" height="2" rx="1" fill="#1a1814" fillOpacity="0.4" />
          <line x1="32" y1="49" x2="95" y2="49" stroke="#1a1814" strokeOpacity="0.2" strokeWidth="1" />
          <rect x="26" y="58" width="2" height="2" rx="1" fill="#b8654a" fillOpacity="0.7" />
          <line x1="32" y1="59" x2="80" y2="59" stroke="#1a1814" strokeOpacity="0.3" strokeWidth="1.2" />
          <line x1="20" y1="68" x2="110" y2="68" stroke="#1a1814" strokeOpacity="0.15" strokeWidth="0.5" strokeDasharray="2 2" />
          <rect x="26" y="72" width="2" height="2" rx="1" fill="#1a1814" fillOpacity="0.3" />
          <line x1="32" y1="73" x2="60" y2="73" stroke="#1a1814" strokeOpacity="0.3" strokeWidth="1" />

          {/* Cartão de crédito à direita */}
          <rect x="125" y="32" width="55" height="32" rx="3" fill="#1a1814" fillOpacity="0.08" />
          <rect x="125" y="38" width="55" height="6" fill="#1a1814" fillOpacity="0.15" />
          <line x1="132" y1="56" x2="170" y2="56" stroke="#1a1814" strokeOpacity="0.2" strokeWidth="0.5" />
          <circle cx="170" cy="60" r="3" fill="#b8654a" fillOpacity="0.6" />
        </svg>
      )}

      {tipo === 'admin' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none" preserveAspectRatio="xMidYMid meet">
          {/* Gráfico de barras + linha de tendência */}
          {[
            { x: 20, h: 25 },
            { x: 45, h: 38 },
            { x: 70, h: 32 },
            { x: 95, h: 50 },
            { x: 120, h: 42 },
            { x: 145, h: 58 },
            { x: 170, h: 48 },
          ].map((bar, i) => (
            <rect
              key={i}
              x={bar.x}
              y={80 - bar.h}
              width="15"
              height={bar.h}
              fill={i === 5 ? '#b8654a' : '#1a1814'}
              fillOpacity={i === 5 ? 0.7 : 0.15 + i * 0.02}
              rx="1"
            />
          ))}
          {/* Linha de tendência cobre */}
          <polyline
            points="27,75 52,65 77,68 102,40 127,50 152,30 177,38"
            fill="none"
            stroke="#b8654a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="3 2"
            strokeOpacity="0.7"
          />
          {/* Ponto de destaque */}
          <circle cx="152" cy="30" r="3" fill="#b8654a" />
          <circle cx="152" cy="30" r="6" fill="#b8654a" fillOpacity="0.2" />
        </svg>
      )}

      {tipo === 'estoque' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none" preserveAspectRatio="xMidYMid meet">
          {/* Caixas de inventário em grid 2x3 */}
          {[
            { x: 30, y: 25, alert: false },
            { x: 70, y: 25, alert: false },
            { x: 110, y: 25, alert: false },
            { x: 150, y: 25, alert: false },
            { x: 30, y: 58, alert: false },
            { x: 70, y: 58, alert: true },
            { x: 110, y: 58, alert: false },
            { x: 150, y: 58, alert: false },
          ].map((box, i) => (
            <g key={i}>
              <rect
                x={box.x}
                y={box.y}
                width="28"
                height="22"
                rx="1"
                fill={box.alert ? '#b8654a' : '#1a1814'}
                fillOpacity={box.alert ? 0.7 : 0.12}
              />
              {box.alert && (
                <>
                  <circle cx={box.x + 14} cy={box.y + 11} r="6" fill="#f6f3ee" fillOpacity="0.9" />
                  <text x={box.x + 14} y={box.y + 14} textAnchor="middle" fill="#b8654a" fontSize="10" fontWeight="700">!</text>
                </>
              )}
              <line
                x1={box.x + 4}
                y1={box.y + 6}
                x2={box.x + 16}
                y2={box.y + 6}
                stroke={box.alert ? '#f6f3ee' : '#1a1814'}
                strokeOpacity={box.alert ? 0.6 : 0.3}
                strokeWidth="0.6"
              />
              <line
                x1={box.x + 4}
                y1={box.y + 10}
                x2={box.x + 12}
                y2={box.y + 10}
                stroke={box.alert ? '#f6f3ee' : '#1a1814'}
                strokeOpacity={box.alert ? 0.5 : 0.2}
                strokeWidth="0.6"
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// ============================================
// TIMELINE STEP - com linha conectora
// ============================================
export function TimelineStep({
  dia,
  titulo,
  descricao,
}: {
  dia: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="group relative bg-[#1a1814] p-8 transition-all duration-500 hover:bg-[#25221c]">
      {/* Linha conectora (exceto no último) */}
      <div className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px bg-[#f6f3ee]/15 lg:block" />
      <div className="pointer-events-none absolute left-12 top-12 bottom-0 hidden w-px bg-[#f6f3ee]/15 sm:block lg:hidden" />

      {/* Número grande */}
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[#b8654a]/30 bg-[#b8654a]/10 transition-all duration-500 group-hover:scale-110 group-hover:border-[#b8654a]/60 group-hover:bg-[#b8654a]/20">
        <span className="text-[14px] font-medium text-[#b8654a]">{dia}</span>
      </div>

      <h3 className="text-[22px] font-normal leading-[1.2] tracking-[-0.02em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
        {titulo}
      </h3>
      <p className="mt-3 text-[14px] leading-[1.55] text-[#f6f3ee]/60">
        {descricao}
      </p>
    </div>
  );
}

// ============================================
// AVATAR GRADIENTE - para depoimentos
// ============================================
export function AvatarGradiente({
  iniciais,
  cor,
  size = 'md',
}: {
  iniciais: string;
  cor: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-[12px]',
    lg: 'h-12 w-12 text-[14px]',
  };
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${cor} font-medium text-white ${sizes[size]}`}
    >
      {iniciais}
    </div>
  );
}

// ============================================
// PLANO DESTAQUE - card de preço
// ============================================
export function PlanoDestaque({
  plano,
}: {
  plano: {
    nome: string;
    preco: string;
    periodo: string;
    descricao: string;
    destaque: boolean;
    badge?: string;
    cta: string;
    ctaIcon: any;
    features: string[];
  };
}) {
  const Icon = plano.ctaIcon;
  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-[3px] p-8 transition-all duration-500 hover:-translate-y-1 sm:p-10 ${
        plano.destaque
          ? 'border-2 border-[#1a1814] bg-[#1a1814] text-[#f6f3ee] shadow-[0_24px_60px_-24px_rgba(26,24,20,0.4)]'
          : 'border border-[#1a1814]/15 bg-[#f6f3ee] text-[#1a1814] hover:border-[#1a1814]/30 hover:shadow-[0_12px_30px_-12px_rgba(26,24,20,0.2)]'
      }`}
    >
      {plano.badge && (
        <span className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full bg-[#b8654a] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#f6f3ee]">
          <Sparkles className="h-3 w-3" />
          {plano.badge}
        </span>
      )}

      {/* Efeito sutil no plano destaque */}
      {plano.destaque && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#b8654a]/10 blur-3xl" />
      )}

      <h3
        className={`relative text-[28px] font-normal leading-[1.1] tracking-[-0.02em] ${plano.destaque ? 'text-[#f6f3ee]' : 'text-[#1a1814]'}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {plano.nome}
      </h3>

      <p className={`relative mt-3 text-[14px] leading-[1.55] ${plano.destaque ? 'text-[#f6f3ee]/65' : 'text-[#1a1814]/65'}`}>
        {plano.descricao}
      </p>

      <div className={`relative mt-8 flex items-baseline gap-2 border-t pt-8 ${plano.destaque ? 'border-[#f6f3ee]/10' : 'border-[#1a1814]/10'}`}>
        <span
          className={`text-[48px] font-normal leading-none tracking-[-0.04em] ${plano.destaque ? 'text-[#f6f3ee]' : 'text-[#1a1814]'}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {plano.preco}
        </span>
        <span className={`text-[14px] ${plano.destaque ? 'text-[#f6f3ee]/55' : 'text-[#1a1814]/55'}`}>
          {plano.periodo}
        </span>
      </div>

      <ul className="relative mt-8 space-y-3 text-[14px]">
        {plano.features.map((f) => (
          <li
            key={f}
            className={`flex items-start gap-2 ${plano.destaque ? 'text-[#f6f3ee]/80' : 'text-[#1a1814]/80'}`}
          >
            <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${plano.destaque ? 'text-[#b8654a]' : 'text-[#1a1814]'}`} strokeWidth={2.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-auto pt-8">
        <BotaoMicro
          href={`/checkout?plano=${plano.nome.toLowerCase()}`}
          variant={plano.destaque ? 'light' : 'dark'}
          size="md"
          icon="right"
        >
          {plano.cta}
        </BotaoMicro>
      </div>
    </div>
  );
}

// ============================================
// BOTÃO MICRO-INTERAÇÃO
// ============================================
export function BotaoMicro({
  href,
  variant = 'dark',
  size = 'md',
  icon = 'right',
  children,
}: {
  href: string;
  variant?: 'dark' | 'light' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: 'right' | 'up-right' | 'none';
  children: ReactNode;
}) {
  const sizeClasses = {
    sm: 'h-9 px-4 text-[12px]',
    md: 'h-12 px-6 text-[14px]',
    lg: 'h-14 px-7 text-[15px]',
  };
  const variantClasses = {
    dark: 'bg-[#1a1814] text-[#f6f3ee] hover:bg-[#1a1814]/90 shadow-[0_8px_24px_-8px_rgba(26,24,20,0.4)] hover:shadow-[0_12px_28px_-8px_rgba(26,24,20,0.6)]',
    light: 'bg-[#f6f3ee] text-[#1a1814] hover:bg-white shadow-[0_8px_24px_-8px_rgba(246,243,238,0.6)]',
    outline: 'border border-[#1a1814]/15 bg-[#f6f3ee] text-[#1a1814] hover:border-[#1a1814]/30 hover:bg-[#efe9df]',
    accent: 'bg-[#b8654a] text-[#f6f3ee] hover:bg-[#b8654a]/90 shadow-[0_8px_24px_-8px_rgba(184,101,74,0.5)]',
  };
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 ${sizeClasses[size]} ${variantClasses[variant]} hover:gap-3 active:scale-[0.98]`}
    >
      {children}
      {icon === 'right' && (
        <ArrowRight className={`${iconSize} transition-transform duration-300 group-hover:translate-x-1`} />
      )}
      {icon === 'up-right' && (
        <ArrowUpRight className={`${iconSize} transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5`} />
      )}
    </Link>
  );
}

// ============================================
// SCROLL HINT - "Role para baixo" sutil
// ============================================
export function ScrollHint() {
  return (
    <div className="flex justify-center pb-8">
      <div className="group flex flex-col items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/40 transition-colors duration-500 hover:text-[#1a1814]/70">
        <span>Role para descobrir mais</span>
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </div>
    </div>
  );
}
