import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/family-ledger-web',
  outputFileTracingRoot: __dirname,
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['firebase', 'recharts'],
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://*.googleusercontent.com https://*.google.com",
            "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
            "frame-src https://*.firebaseapp.com https://accounts.google.com",
            "font-src 'self'",
          ].join('; '),
        },
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'unsafe-none',
        },
      ],
    }]
  },
}

export default nextConfig
