import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin", "latin-ext"],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'UCM - Unified Commerce Platform | Zero Overselling Garantido',
  description: 'Backend centralizado que sincroniza estoque em tempo real entre PDV, e-commerce e WhatsApp. Transações ACID, reserva atômica, zero overselling. A solução definitiva para comércio multicanal.',
  keywords: ['estoque', 'omnichannel', 'e-commerce', 'pdv', 'whatsapp', 'sincronização', 'varejo'],
  generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}

