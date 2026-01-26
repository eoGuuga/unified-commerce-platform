import Link from "next/link"

export function ExplainerCTA() {
  return (
    <Link
      href="#explicacao"
      className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-3 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-foreground shadow-[0_20px_50px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl backdrop-saturate-150 transition-all hover:border-accent/40 hover:bg-white/10 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="relative flex items-center justify-center">
        <span className="absolute -inset-2 rounded-full bg-accent/15 blur-md" />
        <span className="w-2 h-2 rounded-full bg-accent" />
        <span
          className="absolute w-2 h-2 rounded-full bg-accent animate-ping opacity-30"
          style={{ animationDuration: "2.4s" }}
        />
      </span>
      <span className="whitespace-nowrap">Explicação em 1 minuto</span>
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-foreground/80">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </span>
    </Link>
  )
}
