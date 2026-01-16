import type React from "react"
import type { Metadata } from "next"
import { Sora, Bebas_Neue } from "next/font/google"
import { ErrorBoundary } from "@/components/ErrorBoundary"

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
})

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
      <body className={`${sora.variable} ${bebasNeue.variable} font-body`}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
