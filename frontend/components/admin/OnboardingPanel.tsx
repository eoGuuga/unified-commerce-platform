'use client';

import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Compass, Rocket, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionTitle } from './SectionTitle';
import { JourneyCard } from './JourneyCard';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';

interface OnboardingStep {
  key: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  tone: string;
  meta: string;
  actionLabel: string;
  complete: boolean;
}

interface OnboardingPanelProps {
  welcomeName: string;
  workspaceLabel: string;
  userEmail?: string;
  totalOrdersCount: number;
  onboardingSteps: OnboardingStep[];
  completedSteps: number;
  onboardingProgress: number;
  nextStep: OnboardingStep;
  onHide: () => void;
  onJourneyAction: (key: string) => void;
  onOpenPDV: () => void;
  onOpenStorefront: () => void;
}

export function OnboardingPanel({
  welcomeName,
  workspaceLabel,
  userEmail,
  totalOrdersCount,
  onboardingSteps,
  completedSteps,
  onboardingProgress,
  nextStep,
  onHide,
  onJourneyAction,
  onOpenPDV,
  onOpenStorefront,
}: OnboardingPanelProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className={cn(panelClassName, 'relative overflow-hidden p-7 sm:p-9')}>
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_55%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_42%)]" />

        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">
            <Sparkles className="size-3.5" />
            onboarding premium pos-login
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                bem-vindo de volta, {welcomeName}
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Vamos transformar este workspace em uma operacao que arranca confianca no primeiro minuto.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                O command center ja esta bonito. Agora a trilha abaixo organiza os
                fundamentos que fazem a plataforma parecer inevitavelmente premium para
                sua equipe e para o seu cliente.
              </p>
            </div>

            <button
              type="button"
              onClick={onHide}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
            >
              Ocultar guia
            </button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                workspace ativo
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {workspaceLabel}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {userEmail || 'Operador principal conectado ao ecossistema.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                fase da operacao
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {totalOrdersCount > 0 ? 'Em movimento' : 'Estruturacao guiada'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {nextStep.title}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                progresso da jornada
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {completedSteps}/{onboardingSteps.length}
                </p>
                <span className="text-sm font-medium text-accent">{onboardingProgress}% pronto</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-300"
                  style={{ width: `${Math.max(onboardingProgress, 8)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onJourneyAction(nextStep.key)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              {nextStep.actionLabel}
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={onOpenPDV}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
            >
              <Rocket className="size-4" />
              Abrir PDV
            </button>
            <button
              type="button"
              onClick={onOpenStorefront}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
            >
              <Compass className="size-4" />
              Ver loja
            </button>
          </div>
        </div>
      </div>

      <div className={cn(panelClassName, 'p-6 sm:p-7')}>
        <SectionTitle
          eyebrow="primeiros 5 minutos"
          title="Trilha de ativacao da operacao"
          description="Cada passo abaixo foi pensado para transformar o primeiro acesso em confianca, criterio e momentum real."
          action={
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">
              <CheckCircle2 className="size-3.5" />
              {completedSteps} fundamento(s) alinhado(s)
            </div>
          }
        />

        <div className="mt-6 grid gap-4">
          {onboardingSteps.map((step) => (
            <JourneyCard
              key={step.key}
              icon={step.icon}
              eyebrow={step.eyebrow}
              title={step.title}
              description={step.description}
              status={step.status}
              tone={step.tone}
              meta={step.meta}
              actionLabel={step.actionLabel}
              onAction={() => onJourneyAction(step.key)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
