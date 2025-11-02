import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Unified Commerce Platform",
  description: "Plataforma SaaS para unificação de vendas multi-canal",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
