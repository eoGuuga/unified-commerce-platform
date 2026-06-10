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
// WHATSAPP MOCKUP - 3 bolhas animadas em sequência
// ============================================
export function WhatsAppMockup({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleBubbles, setVisibleBubbles] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const timers: NodeJS.Timeout[] = [];
          for (let i = 0; i < 3; i++) {
            timers.push(
              setTimeout(() => {
                setVisibleBubbles((v) => Math.max(v, i + 1));
              }, 800 + i * 1200)
            );
          }
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`space-y-3 ${className}`}>
      <div
        className="ml-auto max-w-xs rounded-2xl rounded-tr-sm bg-white/95 px-4 py-3 text-[14px] text-[#1a1814] shadow-md transition-all duration-700"
        style={{
          opacity: visibleBubbles >= 1 ? 1 : 0,
          transform: visibleBubbles >= 1 ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
        }}
      >
        Oi! Vcs têm a caneca personalizada?
      </div>

      <div
        className="transition-all duration-700"
        style={{
          opacity: visibleBubbles >= 2 ? 1 : 0,
          transform: visibleBubbles >= 2 ? 'translateY(0)' : 'translateY(10px)',
        }}
      >
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm bg-[#1a1814] px-4 py-3 shadow-md">
          <MessageCircle className="h-3.5 w-3.5 text-[#b8654a]" />
          <span className="text-[12px] text-[#f6f3ee]/70">Bot digitando</span>
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f6f3ee]/60" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f6f3ee]/60" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f6f3ee]/60" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>

      <div
        className="max-w-xs rounded-2xl rounded-tl-sm bg-[#1a1814] px-4 py-3 text-[14px] text-[#f6f3ee] shadow-md transition-all duration-700"
        style={{
          opacity: visibleBubbles >= 3 ? 1 : 0,
          transform: visibleBubbles >= 3 ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
        }}
      >
        <p>Oi! Temos sim 😊</p>
        <p className="mt-1.5">Tenho 3 modelos. Quer ver?</p>
        <p className="mt-2 inline-block rounded bg-[#b8654a] px-2 py-0.5 text-[12px] font-medium">
          Ver modelos →
        </p>
      </div>
    </div>
  );
}

// ============================================
// MÓDULO VISUAL - mini-UI SVG por módulo
// ============================================
export function MóduloVisual({ tipo }: { tipo: 'loja' | 'pdv' | 'admin' | 'estoque' }) {
  return (
    <div className="relative mb-6 h-32 overflow-hidden rounded-[3px] border border-[#1a1814]/8 bg-gradient-to-br from-[#1a1814]/[0.04] via-[#1a1814]/[0.02] to-transparent">
      {tipo === 'loja' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none">
          {/* Cards de produto */}
          <rect x="20" y="20" width="35" height="50" rx="2" fill="#1a1814" fillOpacity="0.08" />
          <rect x="22" y="22" width="31" height="28" rx="1" fill="#1a1814" fillOpacity="0.12" />
          <circle cx="37.5" cy="62" r="3" fill="#b8654a" />

          <rect x="65" y="15" width="35" height="50" rx="2" fill="#1a1814" fillOpacity="0.08" />
          <rect x="67" y="17" width="31" height="28" rx="1" fill="#1a1814" fillOpacity="0.12" />
          <circle cx="82.5" cy="57" r="3" fill="#b8654a" />

          <rect x="110" y="22" width="35" height="50" rx="2" fill="#1a1814" fillOpacity="0.08" />
          <rect x="112" y="24" width="31" height="28" rx="1" fill="#1a1814" fillOpacity="0.12" />
          <circle cx="127.5" cy="64" r="3" fill="#b8654a" />

          <rect x="155" y="18" width="35" height="50" rx="2" fill="#1a1814" fillOpacity="0.05" />
          <text x="172" y="48" textAnchor="middle" fill="#1a1814" fillOpacity="0.4" fontSize="20" fontFamily="serif" fontStyle="italic">+</text>
        </svg>
      )}

      {tipo === 'pdv' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none">
          {/* Carrinho + recibo */}
          <rect x="30" y="20" width="100" height="55" rx="2" fill="#1a1814" fillOpacity="0.06" />
          <rect x="30" y="20" width="100" height="12" rx="2" fill="#1a1814" fillOpacity="0.12" />
          <circle cx="40" cy="45" r="2" fill="#1a1814" fillOpacity="0.4" />
          <line x1="48" y1="45" x2="120" y2="45" stroke="#1a1814" strokeOpacity="0.15" strokeWidth="1" />
          <circle cx="40" cy="55" r="2" fill="#1a1814" fillOpacity="0.4" />
          <line x1="48" y1="55" x2="115" y2="55" stroke="#1a1814" strokeOpacity="0.15" strokeWidth="1" />
          <circle cx="40" cy="65" r="2" fill="#b8654a" />
          <line x1="48" y1="65" x2="100" y2="65" stroke="#1a1814" strokeOpacity="0.3" strokeWidth="1.5" />

          {/* Moedas */}
          <circle cx="150" cy="35" r="8" fill="#b8654a" fillOpacity="0.2" />
          <text x="150" y="39" textAnchor="middle" fill="#b8654a" fontSize="10" fontWeight="600">$</text>
          <circle cx="165" cy="55" r="6" fill="#b8654a" fillOpacity="0.15" />
          <text x="165" y="58" textAnchor="middle" fill="#b8654a" fontSize="8" fontWeight="600">$</text>
        </svg>
      )}

      {tipo === 'admin' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none">
          {/* Gráfico de barras */}
          <rect x="20" y="60" width="15" height="20" fill="#1a1814" fillOpacity="0.15" rx="1" />
          <rect x="40" y="45" width="15" height="35" fill="#1a1814" fillOpacity="0.25" rx="1" />
          <rect x="60" y="50" width="15" height="30" fill="#1a1814" fillOpacity="0.2" rx="1" />
          <rect x="80" y="30" width="15" height="50" fill="#b8654a" fillOpacity="0.7" rx="1" />
          <rect x="100" y="40" width="15" height="40" fill="#1a1814" fillOpacity="0.25" rx="1" />
          <rect x="120" y="25" width="15" height="55" fill="#1a1814" fillOpacity="0.3" rx="1" />
          <rect x="140" y="35" width="15" height="45" fill="#1a1814" fillOpacity="0.2" rx="1" />

          {/* Linha de tendência */}
          <polyline
            points="27,70 47,55 67,60 87,40 107,50 127,35 147,45"
            fill="none"
            stroke="#b8654a"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}

      {tipo === 'estoque' && (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" fill="none">
          {/* Caixas de estoque */}
          <rect x="25" y="40" width="22" height="22" fill="#1a1814" fillOpacity="0.15" rx="1" />
          <rect x="25" y="40" width="22" height="22" fill="none" stroke="#1a1814" strokeOpacity="0.3" strokeWidth="1" />
          <line x1="36" y1="40" x2="36" y2="62" stroke="#1a1814" strokeOpacity="0.2" strokeWidth="0.5" />
          <line x1="25" y1="51" x2="47" y2="51" stroke="#1a1814" strokeOpacity="0.2" strokeWidth="0.5" />

          <rect x="52" y="35" width="22" height="22" fill="#1a1814" fillOpacity="0.2" rx="1" />
          <rect x="52" y="35" width="22" height="22" fill="none" stroke="#1a1814" strokeOpacity="0.4" strokeWidth="1" />

          <rect x="79" y="42" width="22" height="22" fill="#1a1814" fillOpacity="0.12" rx="1" />
          <rect x="79" y="42" width="22" height="22" fill="none" stroke="#1a1814" strokeOpacity="0.25" strokeWidth="1" />

          <rect x="106" y="38" width="22" height="22" fill="#b8654a" fillOpacity="0.7" rx="1" />
          <rect x="106" y="38" width="22" height="22" fill="none" stroke="#b8654a" strokeOpacity="0.5" strokeWidth="1" />
          <text x="117" y="53" textAnchor="middle" fill="#f6f3ee" fontSize="10" fontWeight="600">!</text>

          <rect x="133" y="45" width="22" height="22" fill="#1a1814" fillOpacity="0.1" rx="1" />

          <rect x="160" y="40" width="22" height="22" fill="#1a1814" fillOpacity="0.08" rx="1" />
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
          href={plano.nome === 'Escalar' ? '/login' : '/login'}
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
