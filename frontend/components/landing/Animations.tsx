'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';

/**
 * ScrollReveal - fade-in com slide-up ao entrar na viewport.
 * Animação sutil, sem exagero.
 */
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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
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

/**
 * ScrollParallax - move suavemente conforme scroll.
 */
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

/**
 * ScrollCountUp - anima números ao entrar na viewport.
 */
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
          // Tenta extrair número do value (ex: "R$ 197" ou "100" ou "24/7")
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
            // Ease out cubic
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

/**
 * MetricCard - card de métrica com hover lift.
 */
export function MetricCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="group transition-transform duration-500 hover:-translate-y-1">
      <ScrollCountUp
        value={value}
        className="text-[36px] font-normal leading-none tracking-[-0.03em] text-[#1a1814] sm:text-[44px]"
        style={{ fontFamily: 'var(--font-display)' }}
      />
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/50">
        {label}
      </div>
    </div>
  );
}

/**
 * WhatsAppMockup - mockup de conversa WhatsApp animada.
 * Bolhas aparecem em sequência quando entra na viewport.
 */
export function WhatsAppMockup({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleBubbles, setVisibleBubbles] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Animar bolhas em sequência
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
      {/* Bolha cliente */}
      <div
        className="ml-auto max-w-xs rounded-2xl rounded-tr-sm bg-white/90 px-4 py-3 text-[14px] text-[#1a1814] shadow-sm transition-all duration-700"
        style={{
          opacity: visibleBubbles >= 1 ? 1 : 0,
          transform: visibleBubbles >= 1 ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
        }}
      >
        Oi! Vcs têm a caneca personalizada?
      </div>

      {/* Bolha bot - digitando */}
      <div
        className="transition-all duration-700"
        style={{
          opacity: visibleBubbles >= 2 ? 1 : 0,
          transform: visibleBubbles >= 2 ? 'translateY(0)' : 'translateY(10px)',
        }}
      >
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm bg-[#1a1814] px-4 py-3 shadow-sm">
          <MessageCircle className="h-3.5 w-3.5 text-[#b8654a]" />
          <span className="text-[12px] text-[#f6f3ee]/70">Bot digitando</span>
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f6f3ee]/60" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f6f3ee]/60" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f6f3ee]/60" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>

      {/* Bolha bot - resposta */}
      <div
        className="max-w-xs rounded-2xl rounded-tl-sm bg-[#1a1814] px-4 py-3 text-[14px] text-[#f6f3ee] shadow-sm transition-all duration-700"
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
