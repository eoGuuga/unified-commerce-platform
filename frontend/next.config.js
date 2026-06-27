const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['sharp', 'better-sqlite3'],
  // Build usa webpack (script "build": "next build --webpack"), nao Turbopack:
  // o Turbopack mascarava erros de tipo do Next 16 PULANDO rotas silenciosamente
  // (ex.: /loja sumia no build do servidor sem erro). Webpack falha honestamente.
  // outputFileTracingRoot fixa o root em monorepo (backend ao lado).
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