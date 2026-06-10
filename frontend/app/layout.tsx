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

const siteUrl = 'https://gtsofthub.com.br'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'GTSoftHub | Plataforma omnichannel para varejo',
    template: '%s | GTSoftHub',
  },
  description: 'Plataforma premium para varejistas. Estoque único entre loja física, e-commerce e WhatsApp. Bot de WhatsApp que vende 24/7. Sem overselling.',
  keywords: [
    'estoque',
    'omnichannel',
    'e-commerce',
    'pdv',
    'whatsapp',
    'bot whatsapp',
    'varejo',
    'multi-loja',
    'sistema pdv',
    'gestão de estoque',
  ],
  authors: [{ name: 'GTSoftHub' }],
  creator: 'GTSoftHub',
  publisher: 'GTSoftHub',
  applicationName: 'GTSoftHub',
  category: 'SaaS, Varejo, E-commerce',

  // Open Graph (Facebook, LinkedIn, WhatsApp)
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: siteUrl,
    siteName: 'GTSoftHub',
    title: 'GTSoftHub | Vender em qualquer canal, como se fosse tudo um só',
    description: 'Estoque único, PDV, loja online e bot de WhatsApp num só ecossistema. 14 dias grátis.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GTSoftHub - Plataforma omnichannel para varejo',
      },
    ],
  },

  // Twitter / X
  twitter: {
    card: 'summary_large_image',
    title: 'GTSoftHub | Vender em qualquer canal, como se fosse tudo um só',
    description: 'Estoque único, PDV, loja online e bot de WhatsApp num só ecossistema.',
    images: ['/og-image.png'],
    creator: '@gtsofthub',
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Verificação de propriedade
  other: {
    'theme-color': '#f6f3ee',
  },

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },

  // Alternates
  alternates: {
    canonical: siteUrl,
  },
}

export const viewport: Viewport = {
  themeColor: '#f6f3ee',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        {/* Schema.org JSON-LD - ajuda SEO a entender o que é o site */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'GTSoftHub',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description: 'Plataforma omnichannel para varejo. Estoque, PDV, loja online e bot de WhatsApp.',
              offers: {
                '@type': 'Offer',
                price: '197',
                priceCurrency: 'BRL',
                priceValidUntil: '2026-12-31',
                availability: 'https://schema.org/InStock',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.9',
                reviewCount: '127',
              },
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
