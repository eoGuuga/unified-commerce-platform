/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // output: 'standalone',
  serverExternalPackages: ['sharp', 'better-sqlite3'],
  // Disable Turbopack for production build
  experimental: {
    // Use webpack instead of turbopack
  },
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