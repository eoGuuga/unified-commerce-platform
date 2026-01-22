import Link from "next/link"
import { Container } from "@/components/landing/Container"

const labels: Record<string, string> = {
  changelog: "Changelog",
  sobre: "Sobre nós",
  blog: "Blog",
  carreiras: "Carreiras",
  contato: "Contato",
  documentacao: "Documentação",
  api: "API Reference",
  status: "Status do sistema",
  suporte: "Suporte",
  privacidade: "Privacidade",
  termos: "Termos de uso",
  cookies: "Cookies",
}

export default function InfoPage({ params }: { params: { slug: string } }) {
  const title = labels[params.slug] ?? "Conteúdo"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Container className="py-20">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Voltar para a home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          Esta página está em preparação. Em breve publicaremos detalhes oficiais sobre{" "}
          {title.toLowerCase()}.
        </p>
      </Container>
    </div>
  )
}
