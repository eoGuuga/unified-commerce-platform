import Link from "next/link"

export function ExplainerCTA() {
  return (
    <Link
      href="#explicacao"
      className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 rounded-full border border-border/40 bg-card/80 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur transition-all hover:border-border/70 hover:bg-card"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
      Explicação em 1 minuto
    </Link>
  )
}
