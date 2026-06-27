const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['sharp', 'better-sqlite3'],
  // Fixa o root do Turbopack/Next neste diretorio. Sem isto, em monorepo
  // (backend ao lado) o Next 16 infere o workspace root errado e PULA rotas
  // silenciosamente no build (ex.: /loja sumia no build do servidor).
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),
  images: {
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      { protocol: 'https', hostname: 'gtsofthub.com.br' },
      { protocol: 'https', hostname: 'dev.gtsofthub.com.br' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
}

module.exports = nextConfig