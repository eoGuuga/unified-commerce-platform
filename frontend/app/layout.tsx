import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: 'swap',
  variable: '--font-sans',
})

const fraunces = Fraunces({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-display',
  axes: ['opsz'],
})

export const metadata: Metadata = {
  title: {
    default: 'GTSoftHub | Estoque unico para varejo omnichannel',
    template: '%s | GTSoftHub',
  },
  description: 'Plataforma para varejistas omnichannel com estoque único entre loja física, e-commerce e WhatsApp — sem risco de overselling.',
  keywords: ['estoque', 'omnichannel', 'e-commerce', 'pdv', 'whatsapp', 'sincronização', 'varejo'],
  applicationName: 'GTSoftHub',
}

export const viewport: Viewport = {
  themeColor: '#f6f3ee',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
