/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Em prod, deixa o next/image otimizar. Em dev mantemos como esta (mais rapido).
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      { protocol: 'https', hostname: 'gtsofthub.com.br' },
      { protocol: 'https', hostname: 'dev.gtsofthub.com.br' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
}

module.exports = nextConfig
