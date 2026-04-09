import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/family-ledger-web',
  skipTrailingSlashRedirect: true,
  outputFileTracingRoot: __dirname,
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ['firebase-admin'],
  experimental: {
    optimizePackageImports: ['firebase', 'recharts'],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseapp.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.googleusercontent.com https://*.google.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
      "frame-src https://*.firebaseapp.com https://accounts.google.com",
      "font-src 'self'",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/login',
        headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' }],
      },
    ]
  },
}

export default nextConfig
